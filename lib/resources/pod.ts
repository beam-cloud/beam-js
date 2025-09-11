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
} from "../types/pod";
import { GpuType } from "../types/image";
import { RunnerAbstraction } from "./runner";
import { EStubType, DeployStubRequest, DeployStubResponse } from "../types/stub";
import { camelCaseToSnakeCaseKeys } from "../util";

// TODO: Temp fix until common.py is implemented
let USER_CODE_DIR = "/mnt/code";

export class Pods extends APIResource<Pod, PodData> {
  public object: string = "pod";

  protected _constructResource(data: PodData): Pod {
    return new Pod(this, data);
  }

  public async createPod(request: CreatePodRequest): Promise<CreatePodResponse> {
    const response = await this.request<{ data: CreatePodResponse }>({
      method: "POST",
      url: `/api/v1/gateway/pods`,
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

  public async deployStub(request: DeployStubRequest): Promise<DeployStubResponse> {
    const response = await this.request<{ data: DeployStubResponse }>({
      method: "POST",
      url: "/api/v1/gateway/stubs/deploy",
      data: camelCaseToSnakeCaseKeys(request),
    });
    return response.data;
  }
}

/**
 * Pod allows you to run arbitrary services in fast, scalable, and secure remote containers.
 *
 * Parameters in `config`:
 * - `app` (string): Assign the pod to an app. If the app does not exist, it will be created with the given name.
 *   An app is a group of resources (endpoints, task queues, functions, etc).
 * - `entrypoint` (string[]): The command to run in the container. Default is []
 * - `ports` (number[]): The ports to expose on the container. Default is []
 * - `name` (string | undefined): Optional app name for this pod. If not specified, it will typically default to the
 *   working directory name in the Python SDK; here it is user-provided.
 * - `cpu` (number | string): Number of CPU cores allocated to the pod. Default is 1.0
 * - `memory` (number | string): Memory allocated to the pod. Accepts MiB as number, or string with units (e.g. "1Gi"). Default is 128 MiB
 * - `gpu` (GpuType | GpuType[]): The type or name of GPU device(s) to use. If multiple are supplied, the scheduler may prioritize based on order
 * - `gpu_count` (number): Number of GPUs allocated to the pod. Default is 0. If a GPU is specified but this value is 0, it will be treated as 1
 * - `image` (Image): Container image used for execution
 * - `volumes` (any[]): Volumes and/or cloud buckets to mount to the pod
 * - `secrets` (string[]): Secrets injected as environment variables
 * - `env` (Record<string,string>): Environment variables to inject into the container
 * - `keep_warm_seconds` (number): Seconds to keep the container up after the last request. -1 means never scale down to zero. Default is 600
 * - `authorized` (boolean): If false, allows the pod to be accessed without an auth token. Default is false
 * - `tcp` (boolean): Enable raw TCP access when applicable. Default is false
 *
 * Example usage:
 * ```ts
 * // Assuming you have a `Pods` manager instance
 * import { Image } from "beam-js";
 *
 * const image = new Image();
 * const pod = new Pod(podsManager, undefined, { cpu: 2, memory: 512, image, ports: [8080] });
 * const result = await pod.create(["node", "-e", "console.log('Hello, World!')"]);
 * console.log(result.containerId);
 * console.log(result.url);
 * ```
 */
export class Pod implements ResourceObject<PodData> {
  public data: PodData;
  public manager: Pods;

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



  /**
   * Create a new `Pod` resource instance.
   *
   * @param manager Manager responsible for API calls related to pods
   * @param data Optional initial data for the resource
   * @param config Optional configuration for the pod. See class description for available fields
   */
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


  }



  /**
   * Refresh this pod's data from the server.
   * @returns The updated `Pod` instance.
   */
  public async refresh(): Promise<Pod> {
    const data = await this.manager.get({ id: this.data.id });
    this.data = data.data;
    return this;
  }

  /**
   * Create a new container that will run until it completes normally or times out.
   *
   * @param entrypoint Command to run in the pod container (overrides the entrypoint specified in the constructor config)
   * @returns A `PodInstance` representing the created container
   */
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
      this.entrypoint = ["sh", "-c", `cd ${USER_CODE_DIR} && ${this.entrypoint.join(" ")}`];
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

    const prepared = await runner.prepareRuntime(undefined, EStubType.PodRun, true, ignore_patterns);
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
    const response = await this.manager.createPod(request);
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

  /**
   * Deploy a pod.
   *
   * @param name Optional deployment name. If omitted, uses the pod's configured `name`
   * @returns Deployment details and a success boolean
   *
   * @example
   * ```ts
   * const pod = new Pod(podsManager, undefined, { cpu: 1.0, memory: 128, image: new Image(), keep_warm_seconds: 1000 });
   * const { deployment_details, success } = await pod.deploy("my-pod");
   * ```
   */
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
      this.entrypoint = ["sh", "-c", `cd ${USER_CODE_DIR} && ${this.entrypoint.join(" ")}`];
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

    const prepared = await runner.prepareRuntime(undefined, EStubType.PodDeployment, true, ignorePatterns);
    if (!prepared) {
      return { deployment_details: {}, success: false };
    }

    try {
      const req: DeployStubRequest = {
        stubId: (runner as any).stubId,
        name: this.name || "",
      };

      console.log("Deploying");
      const deployRes: DeployStubResponse = await this.manager.deployStub(req);

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
    throw new Error("Not implemented");
  }

  public cleanupDeploymentArtifacts(): void {
    throw new Error("Not implemented");
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

  /**
   * Terminate the container associated with this pod instance.
   *
   * @returns True if the container was terminated; false otherwise
   */
  public async terminate(): Promise<boolean> {
    const response = await this.manager.stopPod({
      containerId: this.containerId,
    });
    return response.ok;
  }
}
