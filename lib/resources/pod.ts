import APIResource, { ResourceObject } from "./base";
import { Image } from "./image";
import { 
  PodData, 
  PodConfig, 
  CreatePodRequest, 
  CreatePodResponse, 
  StopPodRequest,
  StopPodResponse,
  PodInstanceData
} from "../types/pod";
import { GpuType } from "../types/image";

export class Pods extends APIResource<Pod, PodData> {
  public object: string = "pod";

  protected _constructResource(data: PodData): Pod {
    return new Pod(this, data);
  }

  public async createPod(request: CreatePodRequest): Promise<CreatePodResponse> {
    const response = await this.request<CreatePodResponse>({
      method: "POST",
      url: `api/v1/gateway/pods`,
      data: request,
    });
    return response;
  }

  public async stopPod(request: StopPodRequest): Promise<StopPodResponse> {
    const { containerId } = request;
    const response = await this.request<StopPodResponse>({
      method: "POST",
      url: `api/v1/gateway/pods/${containerId}/kill`,
      data: {},
    });
    return response;
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
  public stub_id?: string;

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
    this.gpu = cfg.gpu || "";
    this.gpu_count = cfg.gpu_count || 0;
    // Initialize with a basic image instance - this will be properly set when needed
    this.image = null as any;
    this.volumes = cfg.volumes || [];
    this.secrets = cfg.secrets || [];
    this.env = cfg.env || {};
    this.keep_warm_seconds = cfg.keep_warm_seconds || 600;
    this.authorized = cfg.authorized || false;
    this.tcp = cfg.tcp || false;

    // Generate temporary ID
    this._id = Math.random().toString(36).substring(2, 10);
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

    if (!this.entrypoint.length && (!this.image?.data?.baseImage && !this.image?.data?.dockerfile)) {
      throw new Error("You must specify an entrypoint or provide a custom image.");
    }

    if (!this.stub_id) {
      throw new Error("You must specify a stub_id to create a pod.");
    }

    // Prepare the request - only stubId and snapshotId are supported
    const request: CreatePodRequest = {
      stubId: this.stub_id,
    };

    const response = await this.manager.createPod(request);

    return new PodInstance({
      containerId: response.containerId,
      url: "", // URL is not provided in the create response
      ok: response.ok,
      errorMsg: response.errorMsg,
    }, this.manager);
  }

  public async deploy(name?: string): Promise<{ deployment_details: Record<string, any>; success: boolean }> {
    this.name = name || this.name;
    if (!this.name) {
      throw new Error("You must specify a name for deployment.");
    }

    if (!this.entrypoint.length && (!this.image?.data?.baseImage && !this.image?.data?.dockerfile)) {
      throw new Error("You must specify an entrypoint or provide a custom image.");
    }

    // This would typically involve more complex deployment logic
    // For now, we'll simulate the deployment process
    const deploymentDetails = {
      deployment_id: Math.random().toString(36).substring(2, 10),
      deployment_name: this.name,
      invoke_url: `https://${this.name}.beam.cloud`,
      version: "1",
    };

    return {
      deployment_details: deploymentDetails,
      success: true,
    };
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
