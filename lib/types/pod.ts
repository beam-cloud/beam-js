import BaseData from "./base";
import { GpuType } from "./image";

export { GpuType };

export interface PodData extends BaseData {
  container_id: string;
  status: EPodStatus;
  app: string;
  name: string;
  entrypoint: string[];
  ports: number[];
  cpu: number | string;
  memory: number | string;
  gpu: GpuType | GpuType[];
  gpu_count: number;
  volumes: PodVolume[];
  secrets: string[];
  env: Record<string, string>;
  keep_warm_seconds: number;
  authorized: boolean;
  tcp: boolean;
  url?: string;
}

export enum EPodStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  STOPPED = "STOPPED",
  ERROR = "ERROR",
  TIMEOUT = "TIMEOUT",
  COMPLETE = "COMPLETE",
}

export interface PodVolume {
  name: string;
  mount_path: string;
}

export interface CloudBucket {
  name: string;
  mount_path: string;
  cloud_provider: "aws" | "gcp" | "azure";
}

export interface PodInstanceData {
  containerId: string;
  url: string;
  ok: boolean;
  errorMsg?: string;
}

export interface CreatePodRequest {
  stubId: string;
  snapshotId?: string;
}

export interface CreatePodResponse {
  containerId: string;
  ok: boolean;
  errorMsg?: string;
}

export interface StopPodRequest {
  containerId: string;
}

export interface StopPodResponse {
  ok: boolean;
  errorMsg?: string;
}

export interface PodConfig {
  app?: string;
  entrypoint?: string[];
  ports?: number[];
  name?: string;
  cpu?: number | string;
  memory?: number | string;
  gpu?: GpuType | GpuType[];
  gpu_count?: number;
  volumes?: (PodVolume | CloudBucket)[];
  secrets?: string[];
  env?: Record<string, string>;
  keep_warm_seconds?: number;
  authorized?: boolean;
  tcp?: boolean;
}