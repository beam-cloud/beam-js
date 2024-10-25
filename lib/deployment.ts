import { AxiosResponse } from "axios";
import { IDeployment } from "./types/deployment";
import HttpClient from "./clients/http";
import APIResource from "./api-resource";

interface DeploymentInit {
  name?: string;
  stubType?: string;
  version?: string;
  id?: string;
}

export interface ListDeploymentsOptions {
  stubType?: string;
  name?: string;
  cursor?: string;
  active?: boolean;
  stringFilter?: string;
  version?: string;
  createdAtStart?: string;
  createdAtEnd?: string;
}

class Deployment extends APIResource<IDeployment> {
  public id?: string;
  public name?: string;
  public stubType?: string;
  public version: string;
  protected static modelName: string = "deployment";

  constructor(opts: DeploymentInit) {
    super(opts);

    if (!(opts.stubType && opts.name) && !opts.id) {
      throw new Error("Must provide either an ID or a name + stub type.");
    }

    this.version = opts.version || "latest";
    this.id = opts.id;
    this.name = opts.name;

    const stubTypeSplit = opts.stubType?.split("/");
    if (stubTypeSplit && stubTypeSplit.length > 0) {
      this.stubType = stubTypeSplit[0];
    } else {
      this.stubType = opts.stubType;
    }
  }

  public async retrieve(): Promise<IDeployment> {
    if (this.id) {
      const d = await Deployment.Retrieve(this.id);
      this.copyValues(d);
      return d.data;
    } else {
      // Retrieve by name/version and populate ID
      const deployments = await Deployment.List({
        name: this.name,
        stubType: this.stubType + "/deployment",
      });

      if (deployments.length === 0) {
        throw new Error("Deployment not found.");
      }

      this.copyValues(deployments[0]);
      return deployments[0].data;
    }
  }

  public async delete(): Promise<void> {
    let id = this.id;
    if (!id) {
      const d = await this.retrieve();
      id = d.id;
    }

    return await Deployment.Delete(id);
  }

  public async call(
    data: any,
    path: string = "",
    method: "GET" | "POST" = "POST"
  ): Promise<AxiosResponse<any>> {
    if (!(this.stubType && this.name)) {
      await this.retrieve();
    }

    return await HttpClient.request({
      method,
      url: this.httpUrl(path),
      data,
    });
  }

  public async realtime(
    path: string = "",
    onmessage?: (event: MessageEvent) => void
  ): Promise<WebSocket> {
    if (!(this.stubType && this.name)) {
      await this.retrieve();
    }

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
    return `${HttpClient.opts.gatewayUrl.replace("http", "ws")}/${
      this.stubType
    }/${this.name}/${this.version}${path}?auth_token=${
      HttpClient.opts.apiToken
    }`;
  }

  public httpUrl(path: string = ""): string {
    return `${HttpClient.opts.gatewayUrl}/${this.stubType}/${this.name}/${this.version}${path}`;
  }

  public get data(): IDeployment {
    if (!this._data) {
      throw new Error("Data not loaded. Call .retrieve() first.");
    }
    return this._data;
  }
}

interface EndpointInit {
  name?: string;
  version?: string;
  id?: string;
}

class Endpoint extends Deployment {
  constructor(opts: EndpointInit) {
    super({
      ...opts,
      stubType: "endpoint",
    });
  }

  public async realtime(...args: any): Promise<any> {
    throw new Error("Realtime not supported for endpoint deployments.");
  }
}

class ASGI extends Deployment {
  constructor(opts: EndpointInit) {
    super({
      ...opts,
      stubType: "asgi",
    });
  }
}

class TaskQueue extends Deployment {
  constructor(opts: EndpointInit) {
    super({
      ...opts,
      stubType: "taskqueue",
    });
  }

  public async realtime(...args: any): Promise<any> {
    throw new Error("Realtime not supported for task queues deployments.");
  }
}

class Container extends Deployment {
  constructor(opts: EndpointInit) {
    super({
      ...opts,
      stubType: "container",
    });
  }

  public async realtime(...args: any): Promise<any> {
    throw new Error("Realtime not supported for container deployments.");
  }
}

class Function extends Deployment {
  constructor(opts: EndpointInit) {
    super({
      ...opts,
      stubType: "function",
    });
  }

  public async realtime(...args: any): Promise<any> {
    throw new Error("Realtime not supported for function deployments.");
  }
}

export { Deployment, Endpoint, ASGI, TaskQueue, Container, Function };
