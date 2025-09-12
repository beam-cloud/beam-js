import axios, { Axios, AxiosRequestConfig } from "axios";
import { camelCaseToSnakeCaseKeys } from "./util";

export interface BeamClientOpts {
  token: string;
  workspaceId: string;
  gatewayUrl?: string;
  timeout?: number;
}

export const beamOpts = {
  token: "",
  workspaceId: "",
  gatewayUrl: "https://app.beam.cloud",
};

class BeamClient {
  private _client: Axios;

  public async request(config: AxiosRequestConfig): Promise<any> {
    if (!beamOpts.token) {
      throw new Error("Beam token is not set");
    }
    if (!beamOpts.gatewayUrl) {
      throw new Error("Beam gateway URL is not set");
    }
    if (!beamOpts.workspaceId) {
      throw new Error("Beam workspace ID is not set");
    }

    if (!this._client) {
      this._client = axios.create({
        baseURL: beamOpts.gatewayUrl,
        headers: {
          Authorization: `Bearer ${beamOpts.token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      });
    }

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

export default new BeamClient();

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

// Export Sandbox classes and types
export { Sandbox } from "./resources/abstraction/sandbox";

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
