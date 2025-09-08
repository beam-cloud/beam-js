import BaseData from "./base";
import { VolumeGateway } from "./volume";
import { AutoscalerProto } from "./autoscaler";
import { TaskPolicyProto } from "./task";
import { PricingPolicyProto } from "./pricing";
import { SchemaProto } from "./schema";

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
  PodDeployment = "pod/deployment",
  PodRun = "pod/run",
  Unknown = "unknown",
}

// Stub type constants
export const CONTAINER_STUB_TYPE = "container";
export const FUNCTION_STUB_TYPE = "function";
export const TASKQUEUE_STUB_TYPE = "taskqueue";
export const ENDPOINT_STUB_TYPE = "endpoint";
export const ASGI_STUB_TYPE = "asgi";
export const SCHEDULE_STUB_TYPE = "schedule";
export const BOT_STUB_TYPE = "bot";
export const SHELL_STUB_TYPE = "shell";

export const TASKQUEUE_DEPLOYMENT_STUB_TYPE = "taskqueue/deployment";
export const ENDPOINT_DEPLOYMENT_STUB_TYPE = "endpoint/deployment";
export const ASGI_DEPLOYMENT_STUB_TYPE = "asgi/deployment";
export const FUNCTION_DEPLOYMENT_STUB_TYPE = "function/deployment";
export const SCHEDULE_DEPLOYMENT_STUB_TYPE = "schedule/deployment";
export const BOT_DEPLOYMENT_STUB_TYPE = "bot/deployment";

export const TASKQUEUE_SERVE_STUB_TYPE = "taskqueue/serve";
export const ENDPOINT_SERVE_STUB_TYPE = "endpoint/serve";
export const ASGI_SERVE_STUB_TYPE = "asgi/serve";
export const FUNCTION_SERVE_STUB_TYPE = "function/serve";
export const BOT_SERVE_STUB_TYPE = "bot/serve";

export const POD_DEPLOYMENT_STUB_TYPE = "pod/deployment";
export const POD_RUN_STUB_TYPE = "pod/run";
export const SANDBOX_STUB_TYPE = "sandbox";

export interface SecretVar {
  name: string;
}

export interface GetOrCreateStubRequest {
  objectId: string;
  imageId: string;
  stubType: string;
  name: string;
  appName: string;
  pythonVersion: string;
  cpu: number;
  memory: number;
  gpu: string;
  gpuCount: number;
  handler: string;
  onStart: string;
  onDeploy: string;
  onDeployStubId: string;
  callbackUrl: string;
  keepWarmSeconds: number;
  workers: number;
  maxPendingTasks: number;
  volumes: VolumeGateway[];
  secrets: SecretVar[];
  env: string[];
  forceCreate: boolean;
  authorized: boolean;
  autoscaler: AutoscalerProto;
  taskPolicy: TaskPolicyProto;
  concurrentRequests: number;
  checkpointEnabled: boolean;
  extra: string;
  entrypoint?: string[];
  ports: number[];
  pricing?: PricingPolicyProto;
  inputs?: SchemaProto;
  outputs?: SchemaProto;
  tcp: boolean;
}

export interface GetOrCreateStubResponse {
  ok: boolean;
  stubId: string;
  errMsg?: string;
  warnMsg?: string;
}

export interface GetUrlRequest {
  stubId: string;
  deploymentId: string;
  urlType: string;
  isShell: boolean;
}

export interface GetUrlResponse {
  ok: boolean;
  url: string;
  errMsg?: string;
}
