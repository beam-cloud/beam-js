import { AxiosResponse } from "axios";
import { DeploymentData } from "../types/deployment";
import APIResource, { ResourceObject } from "./base";
import { EStubType } from "../types/stub";

export interface ListDeploymentsOptions {
  stubType?: EStubType;
  name?: string;
  cursor?: string;
  active?: boolean;
  stringFilter?: string;
  version?: string;
  createdAtStart?: string;
  createdAtEnd?: string;
}

export class Deployments extends APIResource<Deployment, DeploymentData> {
  public object: string = "deployment";

  protected _constructResource(data: any): Deployment {
    return new Deployment(this, data);
  }
}

export class Deployment implements ResourceObject<DeploymentData> {
  data: DeploymentData;
  manager: Deployments;

  constructor(resource: Deployments, data: DeploymentData) {
    this.manager = resource;
    this.data = data;
  }

  public async refresh(): Promise<Deployment> {
    const data = await this.manager.get(this.data.id);
    this.data = data.data;
    return this;
  }

  public async delete(): Promise<void> {
    return await this.manager.delete(this.data.id);
  }

  public async call(
    data: any,
    path: string = "",
    method: "GET" | "POST" = "POST"
  ): Promise<AxiosResponse<any>> {
    return await this.manager.request({
      method,
      url: this.httpUrl(path),
      data,
    });
  }

  public async realtime(
    path: string = "",
    onmessage?: (event: MessageEvent) => void
  ): Promise<WebSocket> {
    const ws = new WebSocket(this.websocketUrl(path));

    ws.onmessage = (event) => {
      onmessage && onmessage(event);
    };

    let isReady = false;
    ws.onopen = () => {
      isReady = true;
    };

    while (!isReady) {
      // TODO: Add timeout
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return ws;
  }

  public websocketUrl(path: string = ""): string {
    let version = `v${this.data.version}`;
    if (this.data.version === -1) {
      version = "latest";
    }

    return `${this.manager.client.opts.gatewayUrl?.replace("http", "ws")}/${
      this.stubDeploymentType
    }/${this.data.name}/${version}${path}?auth_token=${
      this.manager.client.opts.token
    }`;
  }

  public httpUrl(path: string = ""): string {
    let version = `v${this.data.version}`;
    if (this.data.version === -1) {
      version = "latest";
    }

    return `${this.manager.client.opts.gatewayUrl}/${this.stubDeploymentType}/${this.data.name}/${version}${path}`;
  }

  public get stubDeploymentType(): string {
    return this.data.stub_type.split("/")[0];
  }
}
