import BaseData from "./base";

export interface Stub extends BaseData {
  id: string;
  config: string;
  config_version: number;
  name: string;
  type: EStubType;
}

export enum EStubType {
  TaskQueueDeployment = "taskqueue/deployment",
  TaskQueueServe = "taskqueue/serve",
  TaskQueue = "taskqueue",
  FunctionDeployment = "function/deployment",
  FunctionServe = "function/serve",
  Function = "function",
  EndpointDeployment = "endpoint/deployment",
  EndpointServe = "endpoint/serve",
  Container = "container",
  ASGI = "asgi",
  ASGIDeployment = "asgi/deployment",
  ASGIServe = "asgi/serve",
  ScheduledJob = "schedule",
  ScheduledJobDeployment = "schedule/deployment",
  Unknown = "unknown",
}
