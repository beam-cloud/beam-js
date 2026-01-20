import BeamClient from "./lib";

export default BeamClient;
export namespace BeamClient {}
export { BeamClient };

export { beamOpts } from "./lib";
export type { BeamClientOpts } from "./lib";
export {
  Sandbox,
  SandboxInstance,
  SandboxFileSystem,
} from "./lib/resources/abstraction/sandbox";
export { Pod, PodInstance } from "./lib/resources/abstraction/pod";
export { Image } from "./lib/resources/abstraction/image";
export { Volume } from "./lib/resources/volume";
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
