import APIResource, { ResourceObject } from "./base";
import { RunData } from "../types/run";
import beamClient, { beamOpts } from "../index";
import { EStubType } from "../types/stub";

class Runs extends APIResource<Run, RunData> {
  public object: string = "task";

  protected _constructResource(data: RunData): Run {
    return new Run(this, data);
  }

  public async list(opts?: any): Promise<Run[]> {
    return super.list({
      stubType: EStubType.PodRun,
      ...opts,
    });
  }

  public async cancel(runs: string[] | Run[]): Promise<void> {
    const ids = runs.map((r) => (r instanceof Run ? r.data.id : r));
    return await beamClient.request({
      method: "DELETE",
      url: `/api/v1/task/${beamOpts.workspaceId}`,
      data: {
        ids,
      },
    });
  }
}

class Run implements ResourceObject<RunData> {
  public data: RunData;
  public manager: Runs;

  constructor(resource: Runs, data: RunData) {
    this.manager = resource;
    this.data = data;
  }

  public async refresh(): Promise<Run> {
    const data = await this.manager.get({ id: this.data.id });
    this.data = data.data;
    return this;
  }

  public async cancel(): Promise<void> {
    return await this.manager.cancel([this]);
  }
}

export default new Runs();
export { Run };
