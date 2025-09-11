import BaseData from "./base";
import { VolumeGateway } from "./volume";
import { AutoscalerConfig } from "./autoscaler";
import { TaskPolicyConfig } from "./task";
import { PricingPolicyConfig } from "./pricing";
import { Schema } from "./schema";

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
  Endpoint = "endpoint",
  Container = "container",
  ASGI = "asgi",
  ASGIDeployment = "asgi/deployment",
  ASGIServe = "asgi/serve",
  ScheduledJob = "schedule",
  ScheduledJobDeployment = "schedule/deployment",
  PodDeployment = "pod/deployment",
  PodRun = "pod/run",
  Bot = "bot",
  BotDeployment = "bot/deployment",
  BotServe = "bot/serve",
  Shell = "shell",
  Sandbox = "sandbox",
  Unknown = "unknown",
}

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
  autoscaler: AutoscalerConfig;
  taskPolicy: TaskPolicyConfig;
  concurrentRequests: number;
  checkpointEnabled: boolean;
  extra: string;
  entrypoint?: string[];
  ports: number[];
  pricing?: PricingPolicyConfig;
  inputs?: Schema;
  outputs?: Schema;
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
export interface DeployStubRequest {
  stubId: string;
  name: string;
}

export interface DeployStubResponse {
  ok: boolean;
  deploymentId: string;
  version: number;
  invokeUrl: string;
}
