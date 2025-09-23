import axios, { Axios, AxiosRequestConfig } from "axios";
import { camelCaseToSnakeCaseKeys } from "./util";

export interface BeamClientOpts {
  token: string;
  workspaceId: string;
  gatewayUrl?: string;
  timeout?: number;
}

export const beamOpts: BeamClientOpts = {
  token: "",
  workspaceId: "",
  gatewayUrl: "https://app.beam.cloud",
};

class BeamClient {
  private _client?: Axios;

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

  public _parseOptsToURLParams(opts: Record<string, any>): any {
    return new URLSearchParams(camelCaseToSnakeCaseKeys(opts));
  }
}

export default new BeamClient();
