import axios, { Axios, AxiosRequestConfig } from "axios";
import { Deployments } from "./resources/deployment";
import { Tasks } from "./resources/task";
import { Volumes } from "./resources/volume";
import { camelCaseToSnakeCaseKeys } from "./util";

export interface BeamClientOpts {
  token: string;
  workspaceId: string;
  gatewayUrl?: string;
  timeout?: number;
}

export default class BeamClient {
  private _client: Axios;
  public opts: BeamClientOpts = {
    token: "",
    workspaceId: "",
    gatewayUrl: "https://app.beam.cloud",
  };
  static BeamClient = this;
  deployments: Deployments = new Deployments(this);
  tasks: Tasks = new Tasks(this);
  volumes: Volumes = new Volumes(this);

  public constructor(opts: BeamClientOpts) {
    this.opts = {
      ...this.opts,
      ...opts,
    };

    this._client = axios.create({
      baseURL: this.opts.gatewayUrl,
      headers: {
        Authorization: `Bearer ${this.opts.token}`,
        "Content-Type": "application/json",
      },
      timeout: this.opts.timeout,
    });
  }

  public static async init(token: string): Promise<BeamClient> {
    const client = new BeamClient({
      token,
      workspaceId: "",
    });
    const workspace = await client._getWorkspace();
    client.opts.workspaceId = workspace.external_id;
    return client;
  }

  public async request(config: AxiosRequestConfig): Promise<any> {
    return await this._client.request(config);
  }

  public async _getWorkspace(): Promise<any> {
    const response = await this.request({
      method: "GET",
      url: `/api/v1/workspace/current`,
    });

    return response.data;
  }

  public _parseOptsToURLParams(opts: Record<string, any>): URLSearchParams {
    return new URLSearchParams(camelCaseToSnakeCaseKeys(opts));
  }
}

export { FileSyncer, setWorkspaceObjectId, getWorkspaceObjectId } from "./sync";

// Export Pod classes and types
export { Pod, PodInstance } from "./resources/abstraction/pod";
export {
  PodData,
  PodInstanceData,
  CreatePodRequest,
  CreatePodResponse,
  StopPodRequest,
  StopPodResponse,
  EPodStatus,
  PodVolume,
} from "./types/pod";

// Export Image classes and types
export { Image } from "./resources/abstraction/image";
export { ImageConfig, ImageData } from "./types/image";

// Export Volume classes and types
export { Volume, Volumes, CloudBucket } from "./resources/volume";
export {
  VolumeData,
  VolumeGateway,
  CloudBucketConfig,
  VolumeConfigGateway,
  GetOrCreateVolumeRequest,
  GetOrCreateVolumeResponse,
} from "./types/volume";

// Export Stub classes and types
export { Stub, StubConfig } from "./resources/abstraction/stub";

// Export supporting types
export { Autoscaler, QueueDepthAutoscaler } from "./types/autoscaler";
export { TaskPolicy } from "./types/task";
export { PricingPolicy, PricingPolicyCostModel } from "./types/pricing";
export { Schema, SchemaField } from "./types/schema";

// Export common types
export {
  LifeCycleMethod,
  TaskStatus,
  TaskStatusHelper,
  TaskExitCode,
  PythonVersion,
  PythonVersionAlias,
  GpuType,
  GpuTypeAlias,
} from "./types/common";

// Export stub types and constants
export { EStubType } from "./types/stub";
