import APIResource, { ResourceObject } from "./base";
import { Image } from "./image";
import { 
  PodData, 
  PodConfig, 
  CreatePodRequest, 
  CreatePodResponse, 
  StopPodRequest,
  StopPodResponse,
  PodInstanceData,
  PodServiceStub
} from "../types/pod";
import { GpuType } from "../types/image";
import { RunnerAbstraction } from "./runner";
import { POD_RUN_STUB_TYPE, POD_DEPLOYMENT_STUB_TYPE, DeployStubRequest, DeployStubResponse } from "../types/stub";
import { camelCaseToSnakeCaseKeys } from "../util";

// PodServiceStub implementation that matches Python's PodServiceStub pattern
export class PodServiceStubImpl implements PodServiceStub {
  private pods: Pods;

  constructor(pods: Pods) {
    this.pods = pods;
  }

  public async createPod(request: CreatePodRequest): Promise<CreatePodResponse> {
    return await this.pods.createPod(request);
  }

  public async stopPod(request: StopPodRequest): Promise<StopPodResponse> {
    return await this.pods.stopPod(request);
  }
}

export class Pods extends APIResource<Pod, PodData> {
  public object: string = "pod";

  protected _constructResource(data: PodData): Pod {
    return new Pod(this, data);
  }

  public async createPod(request: CreatePodRequest): Promise<CreatePodResponse> {
    const response = await this.request<{ data: CreatePodResponse }>({
      method: "POST",
      url: `api/v1/gateway/pods`,
      data: request,
    });
    return response.data;
  }

  public async stopPod(request: StopPodRequest): Promise<StopPodResponse> {
    const { containerId } = request;
    const response = await this.request<{ data: StopPodResponse }>({
      method: "POST",
      url: `api/v1/gateway/pods/${containerId}/kill`,
      data: {},
    });
    return response.data;
  }
}

export class Pod implements ResourceObject<PodData> {
  public data: PodData;
  public manager: Pods;

  // Configuration properties
  public app: string;
  public entrypoint: string[];
  public ports: number[];
  public name?: string;
  public cpu: number | string;
  public memory: number | string;
  public gpu: GpuType | GpuType[];
  public gpu_count: number;
  public image: Image;
  public volumes: any[];
  public secrets: string[];
  public env: Record<string, string>;
  public keep_warm_seconds: number;
  public authorized: boolean;
  public tcp: boolean;

  // Internal properties
  private _id: string;
  private _pod_stub?: PodServiceStub | null;

  constructor(manager: Pods, data?: PodData, config?: PodConfig) {
    this.manager = manager;
    this.data = data || {} as PodData;
    
    // Initialize configuration with defaults
    const cfg = config || {};
    this.app = cfg.app || "";
    this.entrypoint = cfg.entrypoint || [];
    this.ports = cfg.ports || [];
    this.name = cfg.name;
    this.cpu = cfg.cpu || 1.0;
    this.memory = cfg.memory || 128;
    this.gpu = cfg.gpu || GpuType.NoGPU;
    this.gpu_count = cfg.gpu_count || 0;
    this.image = cfg.image || null as any;
    this.volumes = cfg.volumes || [];
    this.secrets = cfg.secrets || [];
    this.env = cfg.env || {};
    this.keep_warm_seconds = cfg.keep_warm_seconds || 600;
    this.authorized = cfg.authorized || false;
    this.tcp = cfg.tcp || false;

    // Generate temporary ID
    this._id = Math.random().toString(36).substring(2, 10);
  }

  // Getter for stub (matches Python's @property decorator)
  public get stub(): PodServiceStub {
    if (!this._pod_stub) {
      this._pod_stub = new PodServiceStubImpl(this.manager);
    }
    return this._pod_stub;
  }

  // Setter for stub (matches Python's @stub.setter decorator)
  public set stub(value: PodServiceStub) {
    this._pod_stub = value;
  }

  public async refresh(): Promise<Pod> {
    const data = await this.manager.get({ id: this.data.id });
    this.data = data.data;
    return this;
  }

  public async create(entrypoint?: string[]): Promise<PodInstance> {
    if (entrypoint) {
      this.entrypoint = entrypoint;
    }

    let is_custom_image = this.image?.data?.baseImage || this.image?.data?.dockerfile

    if (!this.entrypoint.length && !is_custom_image) {
      throw new Error("You must specify an entrypoint or provide a custom image.");
    }

    let ignore_patterns: string[] = [];
    if (is_custom_image) {
        ignore_patterns = ["**"];
    }

    if (!is_custom_image && this.entrypoint) {
        // TODO: Add user code dir
        this.entrypoint = ["sh", "-c", `cd {USER_CODE_DIR} && ${this.entrypoint.join(" ")}`];
    }

    // Prepare runtime using RunnerAbstraction (mirrors Python's prepare_runtime flow)
    const runner = new RunnerAbstraction({
      name: this.name,
      app: this.app,
      cpu: this.cpu as number,
      memory: this.memory as number,
      gpu: this.gpu as any,
      gpuCount: this.gpu_count,
      volumes: this.volumes as any,
      secrets: this.secrets,
      env: this.env,
      keepWarmSeconds: this.keep_warm_seconds,
      authorized: this.authorized,
      tcp: this.tcp,
      ports: this.ports,
      image: this.image,
      entrypoint: this.entrypoint,
    });

    runner.setClient(this.manager.client);

    const prepared = await runner.prepareRuntime(undefined, POD_RUN_STUB_TYPE, true, ignore_patterns);
    console.log("Prepared", prepared);
    if (!prepared) {
      return new PodInstance({
        containerId: "",
        url: "",
        ok: false,
        errorMsg: "Failed to prepare runtime",
      }, this.manager);
    }

    console.log("Creating container");
    const request: CreatePodRequest = {
      stubId: runner.stubId,
    };
    // console.log("Create pod request", request);
    const response = await this.stub.createPod(request);
    // console.log("Create pod response", response);
    console.log("Response ok", response.ok);
    let url = "";
    if (response.ok) {
      console.log(`Container created successfully ===> ${response.containerId}`);

      if (this.keep_warm_seconds < 0) {
        console.log("This container has no timeout, it will run until it completes.");
      } else {
        console.log(`This container will timeout after ${this.keep_warm_seconds} seconds.`);
      }

      const urlRes = await runner.printInvocationSnippet();
      url = urlRes?.url || "";
    }

    return new PodInstance({
      containerId: response.containerId,
      url,
      ok: response.ok,
      errorMsg: response.errorMsg,
    }, this.manager);
  }

  public async deploy(name?: string): Promise<{ deployment_details: Record<string, any>; success: boolean }> {
    this.name = name || this.name;
    if (!this.name) {
      console.error("You must specify an app name (either in the constructor or via the name argument).");
    }

    const isCustomImage = !!(this.image?.data?.baseImage || this.image?.data?.dockerfile);

    if (!this.entrypoint.length && !isCustomImage) {
      console.error("You must specify an entrypoint.");
      return { deployment_details: {}, success: false };
    }

    let ignorePatterns: string[] = [];
    if (isCustomImage) {
      ignorePatterns = ["**"];
    }

    if (!isCustomImage && this.entrypoint && this.entrypoint.length > 0) {
      this.entrypoint = ["sh", "-c", `cd {USER_CODE_DIR} && ${this.entrypoint.join(" ")}`];
    }

    const runner = new RunnerAbstraction({
      name: this.name,
      app: this.app,
      cpu: this.cpu as number,
      memory: this.memory as number,
      gpu: this.gpu as any,
      gpuCount: this.gpu_count,
      volumes: this.volumes as any,
      secrets: this.secrets,
      env: this.env,
      keepWarmSeconds: this.keep_warm_seconds,
      authorized: this.authorized,
      tcp: this.tcp,
      ports: this.ports,
      image: this.image,
      entrypoint: this.entrypoint,
    });

    runner.setClient(this.manager.client);

    const prepared = await runner.prepareRuntime(undefined, POD_DEPLOYMENT_STUB_TYPE, true, ignorePatterns);
    if (!prepared) {
      return { deployment_details: {}, success: false };
    }

    try {
      const req: DeployStubRequest = {
        stubId: (runner as any).stubId,
        name: this.name || "",
      };

      console.log("Deploying");
      const response = await this.manager.client.request({
        method: "POST",
        url: "/api/v1/gateway/stubs/deploy",
        data: camelCaseToSnakeCaseKeys(req),
      });

      console.log("Deploy response", response);``
      const deployRes: DeployStubResponse = response.data;

      if (deployRes.ok) {
        console.log("Deployed 🎉");
        // Invokation details func
        if ((this.ports?.length || 0) > 0) {
          await runner.printInvocationSnippet();
        }
      }

      return {
        deployment_details: {
          deployment_id: deployRes.deploymentId,
          deployment_name: this.name,
          invoke_url: deployRes.invokeUrl,
          version: deployRes.version,
        },
        success: deployRes.ok,
      };
    } catch (error) {
      console.error("Failed to deploy pod:", error);
      return { deployment_details: {}, success: false };
    }
  }

  public generateDeploymentArtifacts(options: Record<string, any> = {}): void {
    // Generate deployment artifacts (similar to Python version)
    const imports = ["Pod"];
    
    const podConfig = {
      app: this.app,
      entrypoint: this.entrypoint,
      ports: this.ports,
      name: this.name,
      cpu: this.cpu,
      memory: this.memory,
      gpu: this.gpu,
      gpu_count: this.gpu_count,
      volumes: this.volumes,
      secrets: this.secrets,
      env: this.env,
      keep_warm_seconds: this.keep_warm_seconds,
      authorized: this.authorized,
      tcp: this.tcp,
      ...options,
    };

    const content = `
import { ${imports.join(", ")} } from "@beam-cloud/beta9";

const pod = new Pod(${JSON.stringify(podConfig, null, 2)});
`;

    // In a real implementation, you'd write this to a file
    console.log(`Generated deployment artifact for pod-${this._id}.ts:`);
    console.log(content);
  }

  public cleanupDeploymentArtifacts(): void {
    // Clean up deployment artifacts
    console.log(`Cleaning up deployment artifacts for pod-${this._id}.ts`);
  }
}

export class PodInstance {
  public containerId: string;
  public url: string;
  public ok: boolean;
  public errorMsg?: string;
  private manager: Pods;

  constructor(data: PodInstanceData, manager: Pods) {
    this.containerId = data.containerId;
    this.url = data.url;
    this.ok = data.ok;
    this.errorMsg = data.errorMsg;
    this.manager = manager;
  }

  public async terminate(): Promise<boolean> {
    const response = await this.manager.stopPod({
      containerId: this.containerId,
    });
    return response.ok;
  }
}
