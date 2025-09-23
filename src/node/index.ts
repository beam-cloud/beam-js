// Node entry re-exports from legacy lib to preserve behavior
import BeamClient from "../../lib";
export default BeamClient;
export namespace BeamClient {}
export { BeamClient };
export { beamOpts } from "../../lib";
export type { BeamClientOpts } from "../../lib";

// Export resources and types from existing lib
export { Pod, PodInstance } from "../../lib/resources/abstraction/pod";
export {
  Sandbox,
  SandboxInstance,
  SandboxFileSystem,
} from "../../lib/resources/abstraction/sandbox";
export { Image } from "../../lib/resources/abstraction/image";
export * from "../../lib/types/image";
export * from "../../lib/types/pod";
export * from "../../lib/types/task";
export * from "../../lib/types/volume";
export * from "../../lib/types/autoscaler";
export * from "../../lib/types/pricing";
export * from "../../lib/types/schema";
export { Volume } from "../../lib/resources/volume";
export { default as Deployments } from "../../lib/resources/deployment";
export * from "../../lib/resources/deployment";
export {
  LifeCycleMethod,
  TaskStatus,
  TaskStatusHelper,
  TaskExitCode,
  PythonVersion,
  GpuType,
} from "../../lib/types/common";
export type { GpuTypeAlias } from "../../lib/types/common";
