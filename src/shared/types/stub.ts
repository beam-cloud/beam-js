export enum EStubType {
  Sandbox = "sandbox/deployment",
  PodRun = "pod/run",
  PodDeployment = "pod/deployment",
}

export interface GetUrlResponse {
  ok: boolean;
  url: string;
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
  keepWarmSeconds: number;
  workers: number;
  maxPendingTasks: number;
  volumes: any[];
  secrets: any[];
  env: string[];
  forceCreate: boolean;
  authorized: boolean;
  autoscaler: any;
  taskPolicy: any;
  concurrentRequests: number;
  checkpointEnabled: boolean;
  entrypoint: string[];
  ports: number[];
  pricing?: any;
  inputs?: any;
  outputs?: any;
  tcp: boolean;
}

export interface GetOrCreateStubResponse {
  ok: boolean;
  stubId: string;
  warnMsg?: string;
  errMsg?: string;
}

export interface DeployStubRequest {
  stubId: string;
  name: string;
}

export interface DeployStubResponse {
  ok: boolean;
  deploymentId?: string;
  invokeUrl?: string;
  version?: number;
  errorMsg?: string;
}

export interface SecretVar {
  name: string;
  value?: string;
}
