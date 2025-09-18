import BeamClient from "./lib";

export default BeamClient;
export namespace BeamClient {}
export { BeamClient };

export { beamOpts } from "./lib";
export type { BeamClientOpts } from "./lib";
export { Image } from "./lib/resources/abstraction/image";
export type {
  ImageConfig,
  ImageBuildResult,
  BuildStep,
  PythonVersion,
  GpuType,
  ImageCredentials,
  ImageCredentialKeys,
  AWSCredentials,
  GCPCredentials,
  DockerHubCredentials,
  NGCCredentials,
  BuildImageRequest,
  BuildImageResponse,
  VerifyImageBuildRequest,
  VerifyImageBuildResponse,
  ImageCredentialValueNotFound,
} from "./lib/types/image";
