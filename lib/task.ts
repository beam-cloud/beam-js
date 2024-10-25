import HttpClient from "./clients/http";
import APIResource from "./api-resource";
import { ITask } from "./types/task";

interface TaskInit {
  id: string;
}

class Task extends APIResource<ITask> {
  protected id: string;
  protected static modelName: string = "task";

  constructor(opts: TaskInit) {
    super(opts);
    this.id = opts.id;
  }

  public get data(): ITask {
    if (!this._data) {
      throw new Error("Data not loaded. Call .retrieve() first.");
    }
    return this._data;
  }

  public async retrieve(): Promise<ITask> {
    console.log(this.id);
    const t = await Task.Retrieve(this.id);
    this.copyValues(t);
    return t.data;
  }

  public async cancel(): Promise<void> {
    return await Task.Cancel([this]);
  }

  public static async Cancel(tasks: string[] | Task[]): Promise<void> {
    const ids = tasks.map((t) => (t instanceof Task ? t.id : t));
    return await HttpClient.delete(
      `/api/v1/task/${HttpClient.opts.workspaceId}`,
      {
        ids,
      }
    );
  }
}

export default Task;
