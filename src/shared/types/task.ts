import BaseData from "./base";

export interface TaskData extends BaseData {
  status: string;
}

export class TaskPolicy {
  maxRetries: number = 0;
  timeout: number = 300000;
  ttl: number = 3600000;
}
