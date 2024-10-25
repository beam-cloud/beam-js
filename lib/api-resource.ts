import HttpClient from "./clients/http";

class APIResource<T> {
  protected _data?: T;
  protected static modelName: string;

  constructor(opts: any) {}

  public copyValues(data: any): void {
    Object.assign(this, data);
  }

  public static async Retrieve(id: string): Promise<any> {
    const resp = await HttpClient.get(
      `/api/v1/${this.modelName}/${HttpClient.opts.workspaceId}/${id}`
    );

    if (resp.status !== 200) {
      throw new Error(`Failed to retrieve deployment: ${resp.statusText}`);
    }

    const d = new this({
      ...resp.data,
    });

    d._data = resp.data;

    return d;
  }

  public static async List(opts?: any): Promise<any[]> {
    const params = HttpClient.parseOptsIntoParams(opts);

    const resp = await HttpClient.get(
      `/api/v1/${this.modelName}/${
        HttpClient.opts.workspaceId
      }/?${params.toString()}`
    );

    if (resp.status !== 200) {
      throw new Error(`Failed to list deployments: ${resp.statusText}`);
    }

    if (!resp.data) {
      return [];
    }

    return resp.data.map((d: any) => {
      const _d = new this(d);
      _d._data = d;
      return _d;
    });
  }

  public static async Delete(id: string): Promise<void> {
    return await HttpClient.delete(
      `/api/v1/${this.modelName}/${HttpClient.opts.workspaceId}/${id}`
    );
  }
}

export default APIResource;
