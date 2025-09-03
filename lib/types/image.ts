import BaseData from "./base";

export const GpuType = {
  NoGPU: "",
  Any: "any",
  T4: "T4",
  L4: "L4",
  A10G: "A10G",
  A100_40: "A100-40",
  A100_80: "A100-80",
  H100: "H100",
  A6000: "A6000",
  RTX4090: "RTX4090",
  L40S: "L40S",
} as const;

export type GpuType = typeof GpuType[keyof typeof GpuType];

export type PythonVersion = 
  | "python3"
  | "python3.8"
  | "python3.9"
  | "python3.10"
  | "python3.11"
  | "python3.12"
  | "micromamba3.8"
  | "micromamba3.9"
  | "micromamba3.10"
  | "micromamba3.11"
  | "micromamba3.12";

export interface BuildStep {
  type: "pip" | "shell" | "micromamba";
  command: string;
}

export interface AWSCredentials {
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_SESSION_TOKEN?: string;
  AWS_REGION?: string;
}

export interface GCPCredentials {
  GCP_ACCESS_TOKEN?: string;
}

export interface DockerHubCredentials {
  DOCKERHUB_USERNAME?: string;
  DOCKERHUB_PASSWORD?: string;
}

export interface NGCCredentials {
  NGC_API_KEY?: string;
}

export type ImageCredentialKeys = 
  | "AWS_ACCESS_KEY_ID"
  | "AWS_SECRET_ACCESS_KEY"
  | "AWS_SESSION_TOKEN"
  | "AWS_REGION"
  | "DOCKERHUB_USERNAME"
  | "DOCKERHUB_PASSWORD"
  | "GCP_ACCESS_TOKEN"
  | "NGC_API_KEY";

export type ImageCredentials = 
  | AWSCredentials
  | DockerHubCredentials
  | GCPCredentials
  | NGCCredentials
  | Record<string, string>
  | ImageCredentialKeys[];

export interface BuildImageRequest {
  pythonVersion?: string;
  pythonPackages?: string[];
  commands?: string[];
  existingImageUri?: string;
  existingImageCreds?: Record<string, string>;
  buildSteps?: BuildStep[];
  envVars?: string[];
  dockerfile?: string;
  buildCtxObject?: string;
  secrets?: string[];
  gpu?: string;
  ignorePython?: boolean;
}

export interface BuildImageResponse {
  imageId?: string;
  msg?: string;
  done?: boolean;
  success?: boolean;
  pythonVersion?: string;
  warning?: boolean;
}

export interface VerifyImageBuildRequest {
  pythonVersion?: string;
  pythonPackages?: string[];
  commands?: string[];
  forceRebuild?: boolean;
  existingImageUri?: string;
  buildSteps?: BuildStep[];
  envVars?: string[];
  dockerfile?: string;
  buildCtxObject?: string;
  secrets?: string[];
  gpu?: string;
  ignorePython?: boolean;
  snapshotId?: string;
}

export interface VerifyImageBuildResponse {
  imageId?: string;
  valid?: boolean;
  exists?: boolean;
}

// TODO: Update this to match the actual response
export interface ImageBuildResult {
  success: boolean;
  imageId?: string;
  pythonVersion?: string;
}

export interface ImageConfig {
  pythonVersion?: PythonVersion | string;
  pythonPackages?: string[] | string;
  commands?: string[];
  baseImage?: string;
  baseImageCreds?: ImageCredentials;
  envVars?: string[] | Record<string, string> | string;
  snapshotId?: string;
}

export interface ImageData extends BaseData {
  pythonVersion: string;
  pythonPackages: string[];
  commands: string[];
  buildSteps: BuildStep[];
  baseImage: string;
  baseImageCreds: Record<string, string>;
  envVars: string[];
  secrets: string[];
  dockerfile: string;
  buildCtxObject: string;
  gpu: string;
  ignorePython: boolean;
  snapshotId: string;
  includeFilesPatterns: string[];
}

export class ImageCredentialValueNotFound extends Error {
  public keyName: string;

  constructor(keyName: string, message?: string) {
    super(message || `Did not find the environment variable ${keyName}. Did you forget to set it?`);
    this.name = "ImageCredentialValueNotFound";
    this.keyName = keyName;
  }
}