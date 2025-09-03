import axios, { Axios, AxiosRequestConfig } from "axios";
import { Deployments } from "./resources/deployment";
import { Tasks } from "./resources/task";
import { Images } from "./resources/image";
import { Pods } from "./resources/pod";
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
  images: Images = new Images(this);
  pods: Pods = new Pods(this);

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

export { FileSyncer, setWorkspaceObjectId, getWorkspaceObjectId } from './sync';

// Export Pod classes and types
export { Pod, Pods, PodInstance } from './resources/pod';
export { 
  PodData, 
  PodConfig, 
  PodInstanceData,
  CreatePodRequest, 
  CreatePodResponse, 
  StopPodRequest,
  StopPodResponse,
  EPodStatus,
  PodVolume,
  CloudBucket,
  GpuType
} from './types/pod';
