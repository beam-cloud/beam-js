import IBase from "./base";
import { IStub } from "./stub";

export interface ITask extends IBase {
  started_at: string;
  ended_at: string;
  status: ETaskStatus;
  stats: ITaskStats;
  container_id: string;
  deployment: ITaskDeployment;
  stub: IStub;
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

interface ITaskStats {
  queue_depth: number;
}

interface ITaskDeployment {
  id: string;
  name: string;
  version: string;
}
