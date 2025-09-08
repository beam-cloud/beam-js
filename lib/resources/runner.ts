import * as path from "path";
import BeamClient from "..";
import { Image } from "./image";
import { Volume } from "./volume";
import { FileSyncer } from "../sync";
import { GpuTypeAlias } from "../types/image";
import { Autoscaler, QueueDepthAutoscaler, AUTOSCALER_TYPES } from "../types/autoscaler";
import { TaskPolicy } from "../types/task";
import { PricingPolicy } from "../types/pricing";
import { Schema } from "../types/schema";
import {
  GetOrCreateStubRequest,
  GetOrCreateStubResponse,
  GetUrlResponse,
  SecretVar,
} from "../types/stub";
import { camelCaseToSnakeCaseKeys } from "../util";

export interface RunnerConfig {
  app?: string;
  cpu?: number | string;
  memory?: number | string;
  gpu?: GpuTypeAlias | GpuTypeAlias[];
  gpuCount?: number;
  image?: Image;
  workers?: number;
  concurrentRequests?: number;
  keepWarmSeconds?: number;
  maxPendingTasks?: number;
  retries?: number;
  timeout?: number;
  volumes?: Volume[];
  secrets?: string[];
  env?: Record<string, string>;
  onStart?: Function;
  onDeploy?: AbstractCallableWrapper;
  callbackUrl?: string;
  authorized?: boolean;
  name?: string;
  autoscaler?: Autoscaler;
  taskPolicy?: TaskPolicy;
  checkpointEnabled?: boolean;
  entrypoint?: string[];
  ports?: number[];
  pricing?: PricingPolicy;
  inputs?: Schema;
  outputs?: Schema;
  tcp?: boolean;
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

export class RunnerAbstraction {
  // Core properties
  public name?: string;
  public app: string;
  public authorized: boolean;
  public image: Image;
  public imageAvailable: boolean = false;
  public filesSynced: boolean = false;
  public stubCreated: boolean = false;
  public runtimeReady: boolean = false;
  public objectId: string = "";
  public imageId: string = "";
  public stubId: string = "";
  public handler: string = "";
  public onStart: string = "";
  public onDeploy?: AbstractCallableWrapper;
  public callbackUrl: string = "";

  // Resource configuration
  public cpu: number;
  public memory: number;
  public gpu: string;
  public gpuCount: number;
  public volumes: Volume[];
  public secrets: SecretVar[];
  public env: string[];
  public workers: number;
  public concurrentRequests: number;
  public keepWarmSeconds: number;
  public maxPendingTasks: number;
  public autoscaler: Autoscaler;
  public taskPolicy: TaskPolicy;
  public checkpointEnabled: boolean;
  public extra: Record<string, any> = {};
  public entrypoint?: string[];
  public tcp: boolean;
  public ports: number[];
  public pricing?: PricingPolicy;
  public inputs?: Schema;
  public outputs?: Schema;

  // Internal state
  public syncer: FileSyncer;
  public isWebsocket: boolean = false;
  public client?: BeamClient;

  constructor(config: RunnerConfig = {}) {
    // Initialize core properties
    this.name = config.name;
    this.app = config.app || "";
    this.authorized = config.authorized !== undefined ? config.authorized : true;
    // Image will be properly initialized when client is set
    this.image = config.image || ({} as Image);
    this.callbackUrl = config.callbackUrl || "";

    // Initialize resource configuration
    this.cpu = this.parseCpu(config.cpu || 1.0);
    this.memory = this.parseMemory(config.memory || 128);
    this.gpu = this.parseGpu(config.gpu || "");
    this.gpuCount = config.gpuCount || 0;
    this.volumes = config.volumes || [];
    this.secrets = (config.secrets || []).map(s => ({ name: s }));
    this.env = this.formatEnv(config.env || {});
    this.workers = config.workers || 1;
    this.concurrentRequests = config.concurrentRequests || 1;
    this.keepWarmSeconds = config.keepWarmSeconds || 10.0;
    this.maxPendingTasks = config.maxPendingTasks || 100;
    this.autoscaler = config.autoscaler || new QueueDepthAutoscaler();
    this.taskPolicy = new TaskPolicy({
      maxRetries: config.taskPolicy?.maxRetries ?? config.retries ?? 0,
      timeout: config.taskPolicy?.timeout ?? config.timeout ?? 0,
      ttl: config.taskPolicy?.ttl ?? 0,
    });
    this.checkpointEnabled = config.checkpointEnabled || false;
    this.entrypoint = config.entrypoint;
    this.tcp = config.tcp || false;
    this.ports = config.ports || [];
    this.pricing = config.pricing;
    this.inputs = config.inputs;
    this.outputs = config.outputs;

    // Set GPU count if GPU specified but count is 0
    if ((this.gpu !== "" || Array.isArray(config.gpu)) && this.gpuCount === 0) {
      this.gpuCount = 1;
    }

    // Map onStart callable if provided
    if (config.onStart) {
      this.mapCallableToAttr("onStart", config.onStart);
    }

    this.onDeploy = this.parseOnDeploy(config.onDeploy);

    // Initialize client and syncer (will be set when prepare_runtime is called)
    this.syncer = {} as FileSyncer; // Will be initialized with client
  }

  public getClient(): BeamClient | undefined {
    return this.client;
  }

  public setClient(client: BeamClient): void {
    this.client = client;
    this.syncer = new FileSyncer(client);
    
    // Initialize image if not provided
    if (!this.image || Object.keys(this.image).length === 0) {
      this.image = Image.create(client.images);
    }
  }

  public async printInvocationSnippet(urlType: string = ""): Promise<GetUrlResponse | null> {
    if (!this.client) {
      console.error("Client not set");
      return null;
    }

    try {
      const response = await this.client.request({
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

      if (res.url.includes("<PORT>") || this.tcp) {
        console.log("Exposed endpoints\n");

        let url = res.url;
        if (this.tcp) {
          url = url.replace("http://", "").replace("https://", "") + ":443";
        }

        this.ports.forEach(port => {
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
        ...(this.authorized ? [`-H 'Authorization: Bearer [YOUR_TOKEN]' \\`] : []),
        "-d '{}'",
      ];

      if (this.isWebsocket) {
        const wsUrl = res.url.replace("http://", "ws://").replace("https://", "wss://");
        const wsCommands = [
          `websocat '${wsUrl}' \\`,
          ...(this.authorized ? [`-H 'Authorization: Bearer [YOUR_TOKEN]'`] : []),
        ];
        console.log(wsCommands.join("\n"));
      } else {
        console.log(commands.join("\n"));
      }

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
        throw new Error("CPU value out of range. Must be between 0.1 and 64 cores.");
      }
    }

    if (typeof cpu === "string") {
      if (cpu.endsWith("m") && /^\d+$/.test(cpu.slice(0, -1))) {
        const millicores = parseInt(cpu.slice(0, -1));
        if (millicores >= minCores * 1000 && millicores <= maxCores * 1000) {
          return millicores;
        } else {
          throw new Error("CPU value out of range. Must be between 100m and 64000m.");
        }
      } else {
        throw new Error("Invalid CPU string format. Must be a digit followed by 'm' (e.g., '1000m').");
      }
    }

    throw new Error("CPU must be a number or string.");
  }

  private parseGpu(gpu: GpuTypeAlias | GpuTypeAlias[]): string {
    if (Array.isArray(gpu)) {
      return gpu.join(",");
    }
    return gpu;
  }

  private formatEnv(env: Record<string, string>): string[] {
    return Object.entries(env).map(([k, v]) => `${k}=${v}`);
  }

  private mapCallableToAttr(attr: string, func: Function): void {
    // This is a simplified version - in a real implementation you might want to:
    // 1. Serialize the function for deployment
    // 2. Handle different environments (Node.js vs browser)
    // 3. Store function metadata
    
    if (attr === "onStart") {
      this.onStart = `${func.name}:${func.name}`;
    } else if (attr === "handler") {
      this.handler = `${func.name}:${func.name}`;
    }
  }

  private parseOnDeploy(func?: AbstractCallableWrapper): AbstractCallableWrapper | undefined {
    if (!func) {
      return undefined;
    }

    // In JavaScript, we can't easily check for decorators like in Python
    // This is a simplified validation
    if (typeof func !== "object" || !func.func || !func.parent) {
      throw new Error("on_deploy must be a callable function with a function decorator");
    }

    return func;
  }

  private schemaToProto(pySchema?: Schema): any {
    if (!pySchema) {
      return undefined;
    }

    const fieldToProto = (field: any): any => {
      if (field.type === "Object" && field.fields) {
        return {
          type: "object",
          fields: {
            fields: Object.fromEntries(
              Object.entries(field.fields.fields).map(([k, v]) => [k, fieldToProto(v)])
            ),
          },
        };
      }
      return { type: field.type };
    };

    const fieldsDict = pySchema.toDict().fields;
    return {
      fields: Object.fromEntries(
        Object.entries(fieldsDict).map(([k, v]) => [k, fieldToProto(v)])
      ),
    };
  }

  public async prepareRuntime(
    func?: Function,
    stubType: string = "container",
    forceCreateStub: boolean = false,
    ignorePatterns?: string[]
  ): Promise<boolean> {
    if (!this.client) {
      console.error("Client not set. Call setClient() first.");
      return false;
    }

    if (func) {
      this.mapCallableToAttr("handler", func);
    }

    const stubName = this.handler ? `${stubType}/${this.handler}` : stubType;

    if (this.runtimeReady) {
      return true;
    }

    // Build image if not available
    if (!this.imageAvailable) {
      try {
        const imageBuildResult = await this.image.build();
        if (imageBuildResult && imageBuildResult.success) {
          this.imageAvailable = true;
          this.imageId = imageBuildResult.imageId || "";
          this.image.pythonVersion = imageBuildResult.pythonVersion || "python3.10";
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
    for (const volume of this.volumes) {
      // Ensure volume has client set
      volume.setClient(this.client);
      
      if (!volume.ready && !(await volume.getOrCreate())) {
        console.error(`Volume is not ready: ${volume.name}`);
        return false;
      }
    }

    // Validate autoscaler
    const autoscalerType = AUTOSCALER_TYPES[this.autoscaler.constructor.name];
    if (!autoscalerType) {
      console.error(`Invalid Autoscaler class: ${this.autoscaler.constructor.name}`);
      return false;
    }

    // Set app name if not provided
    if (!this.app) {
      this.app = this.name || path.basename(process.cwd());
    }

    // Prepare schemas
    const inputs = this.inputs ? this.schemaToProto(this.inputs) : undefined;
    const outputs = this.outputs ? this.schemaToProto(this.outputs) : undefined;

    // Create stub if not already created
    if (!this.stubCreated) {
      const stubRequest: GetOrCreateStubRequest = {
        objectId: this.objectId,
        imageId: this.imageId,
        stubType,
        name: stubName,
        appName: this.app,
        pythonVersion: this.image.pythonVersion || "python3.10",
        cpu: this.cpu,
        memory: this.memory,
        gpu: this.gpu,
        gpuCount: this.gpuCount,
        handler: this.handler,
        onStart: this.onStart,
        onDeploy: this.onDeploy?.parent.handler || "",
        onDeployStubId: this.onDeploy?.parent.stubId || "",
        callbackUrl: this.callbackUrl,
        keepWarmSeconds: this.keepWarmSeconds,
        workers: this.workers,
        maxPendingTasks: this.maxPendingTasks,
        volumes: this.volumes.map(v => v.export()),
        secrets: this.secrets,
        env: this.env,
        forceCreate: forceCreateStub,
        authorized: this.authorized,
        autoscaler: {
          type: autoscalerType,
          maxContainers: this.autoscaler.maxContainers,
          tasksPerContainer: this.autoscaler.tasksPerContainer,
          minContainers: this.autoscaler.minContainers,
        },
        taskPolicy: {
          maxRetries: this.taskPolicy.maxRetries,
          timeout: this.taskPolicy.timeout,
          ttl: this.taskPolicy.ttl,
        },
        concurrentRequests: this.concurrentRequests,
        checkpointEnabled: this.checkpointEnabled,
        extra: JSON.stringify(this.extra),
        entrypoint: this.entrypoint,
        ports: this.ports,
        pricing: this.pricing ? {
          costPerTask: this.pricing.costPerTask,
          costPerTaskDurationMs: this.pricing.costPerTaskDurationMs,
          costModel: this.pricing.costModel,
          maxInFlight: this.pricing.maxInFlight,
        } : undefined,
        inputs,
        outputs,
        tcp: this.tcp,
      };

      try {
        let stubResponse: GetOrCreateStubResponse;

        if (isStubCreatedForWorkspace()) {
          const response = await this.client.request({
            method: "POST",
            url: "/api/v1/gateway/stubs",
            data: camelCaseToSnakeCaseKeys(stubRequest),
          });
          stubResponse = response.data;
        } else {
          // Use a simple lock mechanism
          if (_stubCreationLock) {
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.prepareRuntime(func, stubType, forceCreateStub, ignorePatterns);
          }

          _stubCreationLock = true;
          try {
            const response = await this.client.request({
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
}

export abstract class AbstractCallableWrapper {
  public func: Function;
  public parent: RunnerAbstraction;

  constructor(func: Function, parent: RunnerAbstraction) {
    this.func = func;
    this.parent = parent;
  }

  abstract call(...args: any[]): any;
}