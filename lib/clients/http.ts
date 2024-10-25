import axios, { Axios, AxiosRequestConfig } from "axios";
import { ClientNotInitializedError } from "../exception";
import { camelCaseToSnakeCaseKeys } from "../util";

interface HttpClientOpts {
  apiToken: string;
  workspaceId: string;
  timeout?: number;
  gatewayUrl: string;
}

export default abstract class HttpClient {
  private static _axiosClient: Axios | null = null;
  public static opts: HttpClientOpts = {
    apiToken: "",
    workspaceId: "",
    gatewayUrl: "",
  };

  public static initialize(opts: HttpClientOpts): void {
    if (typeof opts.apiToken !== "string") {
      throw new Error("API Token must be a string");
    }

    if (typeof opts.workspaceId !== "string") {
      throw new Error("Workspace ID must be a string");
    }

    HttpClient.opts = {
      ...opts,
    };
  }

  public static get axiosClient(): Axios {
    if (!HttpClient.opts.apiToken || !HttpClient.opts.workspaceId) {
      throw new ClientNotInitializedError(
        "API Token and Workspace ID must be initialized"
      );
    }

    if (HttpClient._axiosClient === null) {
      HttpClient._axiosClient = axios.create({
        baseURL: HttpClient.opts.gatewayUrl,
        headers: {
          Authorization: `Bearer ${HttpClient.opts.apiToken}`,
          "Content-Type": "application/json",
        },
        timeout: HttpClient.opts.timeout,
      });
    }
    return HttpClient._axiosClient;
  }

  public static async request(config: AxiosRequestConfig): Promise<any> {
    return await HttpClient.axiosClient.request(config);
  }

  public static async post(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<any> {
    return await HttpClient.axiosClient.post(url, data, config);
  }

  public static async get(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<any> {
    return await HttpClient.axiosClient.get(url, config);
  }

  public static async delete(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<any> {
    return await HttpClient.axiosClient.delete(url, {
      data: data,
      ...config,
    });
  }

  public static parseOptsIntoParams(opts: any): URLSearchParams {
    const params = new URLSearchParams();
    opts = camelCaseToSnakeCaseKeys(opts);
    Object.keys(camelCaseToSnakeCaseKeys(opts)).forEach((key) => {
      params.append(key, String(opts[key]));
    });
    return params;
  }
}
