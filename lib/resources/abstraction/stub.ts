import * as path from "path";
import beamClient from "../..";
import { Image } from "./image";
import { Volume } from "../volume";
import { FileSyncer } from "../../sync";
import { GpuTypeAlias } from "../../types/image";
import {
  Autoscaler,
  QueueDepthAutoscaler,
  AUTOSCALER_TYPES,
} from "../../types/autoscaler";
import { TaskPolicy } from "../../types/task";
import { PricingPolicy } from "../../types/pricing";
import { Schema } from "../../types/schema";
import {
  DeployStubRequest,
  DeployStubResponse,
  GetOrCreateStubRequest,
  GetOrCreateStubResponse,
  GetUrlResponse,
  SecretVar,
} from "../../types/stub";
import { camelCaseToSnakeCaseKeys } from "../../util";

export interface StubConfig {
  app?: string;
  cpu: number | string;
  memory: number | string;
  gpu: GpuTypeAlias | GpuTypeAlias[] | "string";
  gpuCount: number;
  image: Image;
  workers: number;
  concurrentRequests: number;
  keepWarmSeconds: number;
  maxPendingTasks: number;
  retries?: number;
  timeout?: number;
  volumes: Volume[];
  secrets: SecretVar[];
  env: Record<string, string> | string[];
  callbackUrl?: string;
  authorized: boolean;
  name: string;
  autoscaler: Autoscaler;
  taskPolicy: TaskPolicy;
  checkpointEnabled: boolean;
  entrypoint: string[];
  ports: number[];
  pricing?: PricingPolicy;
  inputs?: Schema;
  outputs?: Schema;
  tcp: boolean;
}

// Global stub creation state management
let _stubCreatedForWorkspace = false;
let _stubCreationLock = false;

function isStubCreatedForWorkspace(): boolean {
  return _stubCreatedForWorkspace;
}

function setStubCreatedForWorkspace(value: boolean): void {
  _stubCreatedForWorkspace = value;
}

export class Stub {
  // Internal state
  public syncer: FileSyncer;
  public config: StubConfig;
  // Runtime state properties
  public imageAvailable?: boolean = false;
  public filesSynced?: boolean = false;
  public stubCreated?: boolean = false;
  public stubId?: string = "";
  public runtimeReady?: boolean = false;
  public extra?: any = {};
  public imageId?: string = "";
  public objectId?: string = "";

  constructor({
    name,
    app,
    authorized = true,
    image,
    callbackUrl = "",
    cpu = 1,
    ports = [],
    memory = 128,
    gpuCount = 0,
    volumes = [],
    gpu = "",
    secrets = [],
    env = {},
    workers = 1,
    concurrentRequests = 1,
    keepWarmSeconds = 60,
    maxPendingTasks = 100,
    autoscaler = new QueueDepthAutoscaler(),
    taskPolicy = new TaskPolicy(),
    checkpointEnabled = false,
    entrypoint = [],
    pricing = undefined,
    inputs = undefined,
    outputs = undefined,
    tcp = false,
  }: StubConfig) {
    this.config = {} as StubConfig;
    this.config.name = name;
    this.config.app = app || name;
    this.config.authorized = authorized;
    this.config.image = image || new Image();
    this.config.callbackUrl = callbackUrl;
    this.config.cpu = cpu;
    this.config.memory = memory;
    this.config.gpu = gpu;
    this.config.gpuCount = gpuCount;
    this.config.volumes = volumes;
    this.config.secrets = secrets;
    this.config.env = env;
    this.config.workers = workers;
    this.config.concurrentRequests = concurrentRequests;
    this.config.keepWarmSeconds = keepWarmSeconds;
    this.config.maxPendingTasks = maxPendingTasks;
    this.config.autoscaler = autoscaler || new QueueDepthAutoscaler();
    this.config.taskPolicy = taskPolicy;
    this.config.checkpointEnabled = checkpointEnabled;
    this.config.entrypoint = entrypoint;
    this.config.tcp = tcp;
    this.config.ports = ports || [];
    this.config.pricing = pricing;
    this.config.inputs = inputs;
    this.config.outputs = outputs;

    // Set GPU count if GPU specified but count is 0
    if (
      (this.config.gpu !== "" || Array.isArray(this.config.gpu)) &&
      this.config.gpuCount === 0
    ) {
      this.config.gpuCount = 1;
    }

    // Initialize client and syncer (will be set when prepare_runtime is called)
    this.syncer = new FileSyncer();
  }

  public async printInvocationSnippet(
    urlType: string = ""
  ): Promise<GetUrlResponse | null> {
    if (!beamClient) {
      console.error("Client not set");
      return null;
    }

    try {
      const response = await beamClient.request({
        method: "GET",
        url: `/api/v1/gateway/stubs/${this.stubId}/url`,
        data: {
          deploymentId: "", // TODO: Add deployment_id if needed
          urlType: urlType,
          // TODO: Is shell?
        },
      });

      const res: GetUrlResponse = response.data;

      if (!res.ok) {
        console.error("Failed to get invocation URL");
        return null;
      }

      if (res.url.includes("<PORT>") || this.config.tcp) {
        console.log("Exposed endpoints\n");

        let url = res.url;
        if (this.config.tcp) {
          url = url.replace("http://", "").replace("https://", "") + ":443";
        }

        this.config.ports.forEach((port) => {
          const urlText = url.replace("<PORT>", port.toString());
          console.log(`\tPort ${port}: ${urlText}`);
        });

        console.log("");
        return res;
      }

      console.log("Invocation details");
      const commands = [
        `curl -X POST '${res.url}' \\`,
        "-H 'Connection: keep-alive' \\",
        "-H 'Content-Type: application/json' \\",
        ...(this.config.authorized
          ? [`-H 'Authorization: Bearer [YOUR_TOKEN]' \\`]
          : []),
        "-d '{}'",
      ];

      return res;
    } catch (error) {
      console.error("Failed to get invocation URL:", error);
      return null;
    }
  }

  private parseMemory(memory: string | number): number {
    if (typeof memory === "number") {
      return memory;
    }

    if (typeof memory === "string") {
      if (memory.toLowerCase().endsWith("mi")) {
        return parseInt(memory.slice(0, -2));
      } else if (memory.toLowerCase().endsWith("gb")) {
        return parseInt(memory.slice(0, -2)) * 1000;
      } else if (memory.toLowerCase().endsWith("gi")) {
        return parseInt(memory.slice(0, -2)) * 1024;
      } else {
        throw new Error("Unsupported memory format");
      }
    }

    throw new Error("Memory must be a number or string");
  }

  private parseCpu(cpu: number | string): number {
    const minCores = 0.1;
    const maxCores = 64.0;

    if (typeof cpu === "number") {
      if (cpu >= minCores && cpu <= maxCores) {
        return Math.floor(cpu * 1000); // convert cores to millicores
      } else {
        throw new Error(
          "CPU value out of range. Must be between 0.1 and 64 cores."
        );
      }
    }

    if (typeof cpu === "string") {
      if (cpu.endsWith("m") && /^\d+$/.test(cpu.slice(0, -1))) {
        const millicores = parseInt(cpu.slice(0, -1));
        if (millicores >= minCores * 1000 && millicores <= maxCores * 1000) {
          return millicores;
        } else {
          throw new Error(
            "CPU value out of range. Must be between 100m and 64000m."
          );
        }
      } else {
        throw new Error(
          "Invalid CPU string format. Must be a digit followed by 'm' (e.g., '1000m')."
        );
      }
    }

    throw new Error("CPU must be a number or string.");
  }

  private parseGpu(gpu: GpuTypeAlias | GpuTypeAlias[] | "string"): string {
    if (Array.isArray(gpu)) {
      return gpu.join(",");
    }
    return gpu;
  }

  private formatEnv(env: Record<string, string> | string[]): string[] {
    if (Array.isArray(env)) {
      return env;
    }

    return Object.entries(env).map(([k, v]) => `${k}=${v}`);
  }

  private schemaToApi(pySchema?: Schema): any {
    if (!pySchema) {
      return undefined;
    }

    const fieldToApi = (field: any): any => {
      if (field.type === "Object" && field.fields) {
        return {
          type: "object",
          fields: {
            fields: Object.fromEntries(
              Object.entries(field.fields.fields).map(([k, v]) => [
                k,
                fieldToApi(v),
              ])
            ),
          },
        };
      }
      return { type: field.type };
    };

    const fieldsDict = pySchema.toDict().fields;
    return {
      fields: Object.fromEntries(
        Object.entries(fieldsDict).map(([k, v]) => [k, fieldToApi(v)])
      ),
    };
  }

  public async prepareRuntime(
    func?: Function,
    stubType: string = "container",
    forceCreateStub: boolean = false,
    ignorePatterns?: string[]
  ): Promise<boolean> {
    if (!beamClient) {
      console.error("Client not set. Call setClient() first.");
      return false;
    }

    if (this.runtimeReady) {
      return true;
    }

    // Build image if not available
    if (!this.imageAvailable) {
      try {
        const imageBuildResult = await this.config.image?.build();
        if (imageBuildResult && imageBuildResult.success) {
          const image = this.config.image;
          image.isAvailable = true;
          image.data.id = imageBuildResult.imageId || "";
          image.config.pythonVersion =
            imageBuildResult.pythonVersion || "python3.10";
        } else {
          console.error("Image build failed ❌");
          return false;
        }
      } catch (error) {
        console.error("Image build failed:", error);
        return false;
      }
    }

    // Sync files if not already synced
    if (!this.filesSynced) {
      try {
        const syncResult = await this.syncer.sync(ignorePatterns);
        if (syncResult.success) {
          this.filesSynced = true;
          this.objectId = syncResult.object_id;
        } else {
          console.error("File sync failed");
          return false;
        }
      } catch (error) {
        console.error("File sync failed:", error);
        return false;
      }
    }

    // Prepare volumes
    for (const volume of this.config.volumes || []) {
      // Ensure volume has client set
      volume.setClient(beamClient);

      if (!volume.ready && !(await volume.getOrCreate())) {
        console.error(`Volume is not ready: ${volume.name}`);
        return false;
      }
    }

    // Validate autoscaler
    const autoscalerType =
      AUTOSCALER_TYPES[this.config.autoscaler.constructor.name || ""];
    if (!autoscalerType) {
      console.error(
        `Invalid Autoscaler class: ${
          this.config.autoscaler.constructor.name || ""
        }`
      );
      return false;
    }

    // Set app name if not provided
    if (!this.config.app) {
      this.config.app = this.config.name || path.basename(process.cwd());
    }

    // Prepare schemas
    const inputs = this.config.inputs
      ? this.schemaToApi(this.config.inputs)
      : undefined;
    const outputs = this.config.outputs
      ? this.schemaToApi(this.config.outputs)
      : undefined;

    // Create stub if not already created
    if (!this.stubCreated) {
      const stubRequest: GetOrCreateStubRequest = {
        objectId: this.objectId!,
        imageId: this.config.image.data.id,
        stubType,
        name: this.config.name,
        appName: this.config.app,
        pythonVersion: this.config.image?.config.pythonVersion || "python3.10",
        cpu: this.parseCpu(this.config.cpu),
        memory: this.parseMemory(this.config.memory),
        gpu: this.parseGpu(this.config.gpu),
        gpuCount: this.config.gpuCount,
        keepWarmSeconds: this.config.keepWarmSeconds,
        workers: this.config.workers,
        maxPendingTasks: this.config.maxPendingTasks,
        volumes: this.config.volumes.map((v) => v.export()),
        secrets: this.config.secrets,
        env: this.formatEnv(this.config.env),
        forceCreate: forceCreateStub,
        authorized: this.config.authorized,
        autoscaler: {
          type: autoscalerType,
          maxContainers: this.config.autoscaler.maxContainers,
          tasksPerContainer: this.config.autoscaler.tasksPerContainer,
          minContainers: this.config.autoscaler.minContainers,
        },
        taskPolicy: {
          maxRetries: this.config.taskPolicy.maxRetries,
          timeout: this.config.taskPolicy.timeout,
          ttl: this.config.taskPolicy.ttl,
        },
        concurrentRequests: this.config.concurrentRequests,
        checkpointEnabled: this.config.checkpointEnabled,
        entrypoint: this.config.entrypoint,
        ports: this.config.ports,
        pricing: this.config.pricing
          ? {
              costPerTask: this.config.pricing.costPerTask,
              costPerTaskDurationMs: this.config.pricing.costPerTaskDurationMs,
              costModel: this.config.pricing.costModel,
              maxInFlight: this.config.pricing.maxInFlight,
            }
          : undefined,
        inputs,
        outputs,
        tcp: this.config.tcp,
      };

      try {
        let stubResponse: GetOrCreateStubResponse;

        if (isStubCreatedForWorkspace()) {
          const response = await beamClient.request({
            method: "POST",
            url: "/api/v1/gateway/stubs",
            data: camelCaseToSnakeCaseKeys(stubRequest),
          });
          stubResponse = response.data;
        } else {
          // Use a simple lock mechanism
          if (_stubCreationLock) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return this.prepareRuntime(
              func,
              stubType,
              forceCreateStub,
              ignorePatterns
            );
          }

          _stubCreationLock = true;
          try {
            const response = await beamClient.request({
              method: "POST",
              url: "/api/v1/gateway/stubs",
              data: camelCaseToSnakeCaseKeys(stubRequest),
            });
            stubResponse = response.data;
            setStubCreatedForWorkspace(true);
          } finally {
            _stubCreationLock = false;
          }
        }

        if (stubResponse.ok) {
          this.stubCreated = true;
          this.stubId = stubResponse.stubId;
          if (stubResponse.warnMsg) {
            console.warn(stubResponse.warnMsg);
          }
        } else {
          const error = stubResponse.errMsg || "Failed to get or create stub";
          console.error(error);
          return false;
        }
      } catch (error) {
        console.error("Failed to create stub:", error);
        return false;
      }
    }

    this.runtimeReady = true;
    return true;
  }

  public async deployStub(
    request: DeployStubRequest
  ): Promise<DeployStubResponse> {
    const response = await beamClient.request({
      method: "POST",
      url: "/api/v1/gateway/stubs/deploy",
      data: camelCaseToSnakeCaseKeys(request),
    });
    return response.data;
  }
}
