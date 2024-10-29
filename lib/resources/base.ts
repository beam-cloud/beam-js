import { serializeNestedBaseObject } from "../types/base";
import BeamClient from "..";
import { AxiosRequestConfig } from "axios";

export interface ResourceObject<ResourceType> {
  data: ResourceType;
  manager: APIResource<any, ResourceType>;
}

abstract class APIResource<Resource, ResourceType> {
  protected object: string;
  public client: BeamClient;

  constructor(client: BeamClient) {
    this.client = client;
  }

  protected abstract _constructResource(data: ResourceType): Resource;

  public copyValues(data: any): void {
    // This copy values of data into `this` object only if the key exists in `this`
    (Object.keys(this) as Array<keyof this>).forEach((key) => {
      if (data.hasOwnProperty(key)) {
        this[key] = data[key];
      }
    });
  }

  public async request<ResponseType>(
    config: AxiosRequestConfig
  ): Promise<ResponseType> {
    return await this.client.request(config);
  }

  public async get({ id }: { id: string }): Promise<Resource> {
    const resp = await this.client.request({
      url: `/api/v1/${this.object}/${this.client.opts.workspaceId}/${id}`,
    });

    if (resp.status !== 200) {
      throw new Error(`Failed to retrieve deployment: ${resp.statusText}`);
    }

    const serializedData = serializeNestedBaseObject(resp.data);

    return this._constructResource(serializedData);
  }

  public async list(opts?: any): Promise<Resource[]> {
    const params = this.client._parseOptsToURLParams(opts);
    const resp = await this.client.request({
      url: `/api/v1/${this.object}/${
        this.client.opts.workspaceId
      }?${params.toString()}`,
    });

    if (resp.status !== 200) {
      throw new Error(`Failed to list deployments: ${resp.statusText}`);
    }

    if (!resp.data) {
      return [];
    }

    return resp.data.map((d: ResourceType) => {
      const serializedData = serializeNestedBaseObject(d);

      return this._constructResource(serializedData);
    });
  }

  public async delete(id: string): Promise<void> {
    return await this.client.request({
      method: "DELETE",
      url: `/api/v1/${this.object}/${this.client.opts.workspaceId}/${id}`,
    });
  }
}

export default APIResource;
