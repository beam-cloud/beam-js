import BaseData from "./base";

export interface TaskPolicyConfig {
  maxRetries?: number;
  timeout?: number;
  ttl?: number;
}

/**
 * Task policy for a function. This helps manages lifecycle of an individual task.
 *
 * Parameters:
 *   maxRetries: The maximum number of times a task will be retried if the container crashes. Default is 0.
 *   timeout: The maximum number of seconds a task can run before it times out.
 *            Default depends on the abstraction that you are using.
 *            Set it to -1 to disable the timeout (this does not disable timeout for endpoints).
 *   ttl: The expiration time for a task in seconds. Must be greater than 0 and less than 24 hours (86400 seconds).
 */
export class TaskPolicy {
  public maxRetries: number;
  public timeout: number;
  public ttl: number;

  constructor(config: TaskPolicyConfig = {}) {
    this.maxRetries = config.maxRetries ?? 0; // Default 0 to match Python
    this.timeout = config.timeout ?? 0; // Default 0 to match Python
    this.ttl = config.ttl ?? 0; // Default 0 to match Python
  }
}

export interface TaskData extends BaseData {
  status: ETaskStatus;
  container_id: string;
  started_at: string;
  ended_at: string;
  stub_id: string;
  stub_name: string;
  workspace_id: string;
  workspace_name: string;
}

export interface ListTasksResponse {
  ok: boolean;
  errMsg: string;
  tasks: TaskData[];
  total: number;
}

export enum ETaskStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  ERROR = "ERROR",
  TIMEOUT = "TIMEOUT",
  RETRY = "RETRY",
  COMPLETE = "COMPLETE",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}
