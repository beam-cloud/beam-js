import BaseData from "./base";
import { Stub } from "./stub";

export interface TaskData extends BaseData {
  started_at: string;
  ended_at: string;
  status: ETaskStatus;
  stats: TaskStats;
  container_id: string;
  deployment: TaskDeployment;
  stub: Stub;
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

export interface TaskStats {
  queue_depth: number;
}

export interface TaskDeployment {
  id: string;
  name: string;
  version: string;
}
