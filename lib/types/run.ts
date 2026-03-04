import BaseData from "./base";

export interface RunData extends BaseData {
  status: ERunStatus;
  containerId: string;
  startedAt: string;
  endedAt: string;
  stubId: string;
  stubName: string;
  workspaceId: string;
  workspaceName: string;
}

export enum ERunStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  ERROR = "ERROR",
  TIMEOUT = "TIMEOUT",
  RETRY = "RETRY",
  COMPLETE = "COMPLETE",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}
