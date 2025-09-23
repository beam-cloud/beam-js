import BeamClient, { beamOpts } from "../shared/client";

export default BeamClient;
export { BeamClient };
export { beamOpts };

// Shared resources
export { default as Deployments } from "../shared/resources/deployment";
export * from "../shared/resources/deployment";
export * from "../shared/types/deployment";

export * from "../shared/resources/task";
export * from "../shared/types/task";

export * from "../shared/types/pod";

export { Volume } from "../shared/resources/volume";
export * from "../shared/types/volume";

export * from "../shared/types/autoscaler";
export * from "../shared/types/pricing";
export * from "../shared/types/schema";

export {
  LifeCycleMethod,
  TaskStatus,
  TaskStatusHelper,
  TaskExitCode,
  PythonVersion,
  GpuType,
} from "../shared/types/common";
export type { GpuTypeAlias } from "../shared/types/common";

// Browser stubs for Node-only APIs
export { Image } from "./stubs/image";
export { Pod, PodInstance } from "./stubs/pod";
export { Sandbox, SandboxInstance, SandboxFileSystem } from "./stubs/sandbox";
export * from "./stubs/stub";
