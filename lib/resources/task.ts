import APIResource, { ResourceObject } from "./base";
import { TaskData } from "../types/task";

export class Tasks extends APIResource<Task, TaskData> {
  public object: string = "task";

  protected _constructResource(data: TaskData): Task {
    return new Task(this, data);
  }

  public async cancel(tasks: string[] | Task[]): Promise<void> {
    const ids = tasks.map((t) => (t instanceof Task ? t.data.id : t));
    return await this.client.request({
      method: "DELETE",
      url: `/api/v1/task/${this.client.opts.workspaceId}`,
      data: {
        ids,
      },
    });
  }
}

export class Task implements ResourceObject<TaskData> {
  public data: TaskData;
  public manager: Tasks;

  constructor(resource: Tasks, data: TaskData) {
    this.manager = resource;
    this.data = data;
  }

  public async refresh(): Promise<Task> {
    const data = await this.manager.get(this.data.id);
    this.data = data.data;
    return this;
  }

  public async cancel(): Promise<void> {
    return await this.manager.cancel([this]);
  }
}
