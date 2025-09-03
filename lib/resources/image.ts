import * as fs from "fs";
import * as path from "path";
import APIResource from "./base";
import {
  ImageData,
  ImageConfig,
  BuildImageRequest,
  BuildImageResponse,
  VerifyImageBuildRequest,
  VerifyImageBuildResponse,
  ImageBuildResult,
  BuildStep,
  PythonVersion,
  GpuType,
  ImageCredentials,
  ImageCredentialValueNotFound,
} from "../types/image";
import { camelCaseToSnakeCaseKeys } from "../util";

const DEFAULT_PYTHON_VERSION: PythonVersion = "python3.10";
export class Images extends APIResource<Image, ImageData> {
  public object: string = "image";

  protected _constructResource(data: ImageData): Image {
    return new Image(this, data);
  }

  public async buildImage(request: BuildImageRequest): Promise<AsyncIterable<BuildImageResponse>> {
    const apiRequest = this._transformRequestToSnakeCase(request);
    
    const response = await this.request<any>({
      method: "POST",
      url: "/api/v1/gateway/images/build",
      data: apiRequest,
      responseType: "stream",
    });

    return this._createAsyncIterable(response);
  }

  private _transformRequestToSnakeCase(request: BuildImageRequest): any {
    const transformed = camelCaseToSnakeCaseKeys(request);
    
    if (transformed.gpu === GpuType.NoGPU) {
      delete transformed.gpu;
    }
    
    return transformed;
  }

  private async *_createAsyncIterable(response: any): AsyncIterable<BuildImageResponse> {
    const stream = response.data;
    let buffer = '';
    
    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine) {
          try {
            const jsonResponse = JSON.parse(trimmedLine).result;
            yield jsonResponse as BuildImageResponse;
          } catch (error) {
            console.warn('Failed to parse JSON line:', trimmedLine, error);
          }
        }
      }
    }
    
    if (buffer.trim()) {
      try {
        const jsonResponse = JSON.parse(buffer.trim()).result;
        yield jsonResponse as BuildImageResponse;
      } catch (error) {
        console.warn('Failed to parse final JSON:', buffer, error);
      }
    }
  }

  public async verifyImageBuild(request: VerifyImageBuildRequest): Promise<VerifyImageBuildResponse> {
    const apiRequest = this._transformVerifyRequestToSnakeCase(request);
    
    const response = await this.request<{ data: VerifyImageBuildResponse }>({
      method: "POST",
      url: "/api/v1/gateway/images/verify-build",
      data: apiRequest,
    });

    return response.data;
  }

  private _transformVerifyRequestToSnakeCase(request: VerifyImageBuildRequest): any {
    const transformed = camelCaseToSnakeCaseKeys(request);
    
    if (transformed.gpu === GpuType.NoGPU) {
      delete transformed.gpu;
    }
    
    return transformed;
  }
}

export class Image {
  public data: ImageData;
  public manager: Images;

  public pythonVersion: string;
  public pythonPackages: string[];
  public commands: string[];
  public buildSteps: BuildStep[];
  public baseImage: string;
  public baseImageCreds: Record<string, string>;
  public envVars: string[];
  public secrets: string[];
  public dockerfile: string;
  public buildCtxObject: string;
  public gpu: string;
  public ignorePython: boolean;
  public snapshotId: string;
  public includeFilesPatterns: string[];

  constructor(manager: Images, data?: Partial<ImageData>) {
    this.manager = manager;
    this.data = data as ImageData;

    this.pythonVersion = data?.pythonVersion || DEFAULT_PYTHON_VERSION;
    this.pythonPackages = data?.pythonPackages || [];
    this.commands = data?.commands || [];
    this.buildSteps = data?.buildSteps || [];
    this.baseImage = data?.baseImage || "";
    this.baseImageCreds = data?.baseImageCreds || {};
    this.envVars = data?.envVars || [];
    this.secrets = data?.secrets || [];
    this.dockerfile = data?.dockerfile || "";
    this.buildCtxObject = data?.buildCtxObject || "";
    this.gpu = data?.gpu || GpuType.NoGPU;
    this.ignorePython = data?.ignorePython || false;
    this.snapshotId = data?.snapshotId || "";
    this.includeFilesPatterns = data?.includeFilesPatterns || [];
  }

  static create(manager: Images, config: ImageConfig = {}): Image {
    const image = new Image(manager);

    // Handle python packages (string path to requirements.txt or array)
    let pythonPackages: string[] = [];
    if (typeof config.pythonPackages === "string") {
      pythonPackages = image._loadRequirementsFile(config.pythonPackages);
    } else if (Array.isArray(config.pythonPackages)) {
      pythonPackages = config.pythonPackages;
    }

    image.pythonVersion = config.pythonVersion || DEFAULT_PYTHON_VERSION;
    image.pythonPackages = image._sanitizePythonPackages(pythonPackages);
    image.commands = config.commands || [];
    image.baseImage = config.baseImage || "";
    image.baseImageCreds = image._processCredentials(config.baseImageCreds || {});
    image.snapshotId = config.snapshotId || "";

    if (config.envVars) {
      image.withEnvs(config.envVars);
    }

    return image;
  }

  static async fromDockerfile(manager: Images, dockerfilePath: string, contextDir?: string): Promise<Image> {
    const image = new Image(manager);
    
    if (!contextDir) {
      contextDir = path.dirname(dockerfilePath);
    }

    try {
      // Sync files to get build context object ID
      console.log(`Syncing build context from: ${contextDir}`);
      const objectId = await image.syncFiles(contextDir);
      image.buildCtxObject = objectId;
      console.log(`Build context synced with object ID: ${objectId}`);
    } catch (error) {
      throw new Error(`Failed to sync build context: ${error}`);
    }

    try {
      const dockerfile = fs.readFileSync(dockerfilePath, "utf8");
      image.dockerfile = dockerfile;
    } catch (error) {
      throw new Error(`Failed to read Dockerfile at ${dockerfilePath}: ${error}`);
    }

    return image;
  }

  static fromRegistry(manager: Images, imageUri: string, credentials?: ImageCredentials): Image {
    return Image.create(manager, {
      baseImage: imageUri,
      baseImageCreds: credentials,
    });
  }

  static fromSnapshot(manager: Images, snapshotId: string): Image {
    return Image.create(manager, { snapshotId });
  }

  async exists(): Promise<{ exists: boolean; result: ImageBuildResult }> {
    const request: VerifyImageBuildRequest = {
      pythonPackages: this.pythonPackages,
      pythonVersion: this.pythonVersion,
      commands: this.commands,
      buildSteps: this.buildSteps,
      forceRebuild: false,
      existingImageUri: this.baseImage,
      envVars: this.envVars,
      dockerfile: this.dockerfile,
      buildCtxObject: this.buildCtxObject,
      secrets: this.secrets,
      gpu: this.gpu,
      ignorePython: this.ignorePython,
      snapshotId: this.snapshotId,
    };

    const response = await this.manager.verifyImageBuild(request);

    return {
      exists: response.exists || false,
      result: {
        success: response.exists || false,
        imageId: response.imageId,
        pythonVersion: this.pythonVersion,
      },
    };
  }

  async build(): Promise<ImageBuildResult> {
    console.log("Building image...");

    if (this.baseImage && this.dockerfile) {
      throw new Error("Cannot use fromDockerfile and provide a custom base image.");
    }

    // Check if image already exists
    const { exists, result } = await this.exists();
    if (exists) {
      console.log("Using cached image");
      return result;
    }

    const request: BuildImageRequest = {
      pythonPackages: this.pythonPackages,
      pythonVersion: this.pythonVersion,
      commands: this.commands,
      buildSteps: this.buildSteps,
      existingImageUri: this.baseImage,
      existingImageCreds: this.getCredentialsFromEnv(),
      envVars: this.envVars,
      dockerfile: this.dockerfile,
      buildCtxObject: this.buildCtxObject,
      secrets: this.secrets,
      gpu: this.gpu,
      ignorePython: this.ignorePython,
    };

    let lastResponse: BuildImageResponse = { success: false };

    try {
      const responseIterable = await this.manager.buildImage(request);
      for await (const response of responseIterable) {
        if (response.warning) {
          console.warn("WARNING: " + response.msg);
        } else if (response.msg && !response.done) {
          if (typeof process !== 'undefined' && process.stdout) {
            process.stdout.write(response.msg);
          } else {
            console.log(response.msg);
          }
        }

        if (response.done) {
          lastResponse = response;
          break;
        }
      }
    } catch (error) {
      console.error("Build failed:", error);
      return { success: false };
    }

    if (!lastResponse.success) {
      console.error(lastResponse.msg || "Build failed");
      return { success: false };
    }

    console.log("Build complete");
    return {
      success: true,
      imageId: lastResponse.imageId,
      pythonVersion: lastResponse.pythonVersion,
    };
  }

  /**
   * Use micromamba to manage python packages.
   * @returns The image instance.
   */
  micromamba(): Image {
    if (this.pythonVersion === "python3") {
      this.pythonVersion = "python3.11";
    }
    this.pythonVersion = this.pythonVersion.replace("python", "micromamba");
    return this;
  }

  /**
   * Add micromamba packages that will be installed when building the image.
   * These will be executed at the end of the image build and in the
   * order they are added. If a single string is provided, it will be
   * interpreted as a path to a requirements.txt file.

   * @param packages The micromamba packages to add or the path to a requirements.txt file.
   * @param channels The micromamba channels to use.
   * @returns The image instance
   */
  addMicromambaPackages(packages: string[] | string, channels: string[] = []): Image {
    if (!this.pythonVersion.startsWith("micromamba")) {
      throw new Error("Micromamba must be enabled to use this method.");
    }

    let packageList: string[];
    if (typeof packages === "string") {
      packageList = this._sanitizePythonPackages(this._loadRequirementsFile(packages));
    } else {
      packageList = packages;
    }

    for (const pkg of packageList) {
      this.buildSteps.push({ command: pkg, type: "micromamba" });
    }

    for (const channel of channels) {
      this.buildSteps.push({ command: `-c ${channel}`, type: "micromamba" });
    }

    return this;
  }

  /**
   * Add shell commands that will be executed when building the image.
   * @param commands The shell commands to execute.
   * @returns The image instance.
   */
  addCommands(commands: string[]): Image {
    for (const command of commands) {
      this.buildSteps.push({ command, type: "shell" });
    }
    return this;
  }

  /**
   * Add python packages that will be installed when building the image.
   * These will be executed at the end of the image build and in the
   * order they are added. 
   * If a single string is provided, it will be
   * interpreted as a path to a requirements.txt file.
   *
   * @param packages The python packages to add or the path to a requirements.txt file. Valid package names are: numpy, pandas==2.2.2, etc.
   * @returns The image instance.
   */
  addPythonPackages(packages: string[] | string): Image {
    let packageList: string[];
    if (typeof packages === "string") {
      try {
        packageList = this._sanitizePythonPackages(this._loadRequirementsFile(packages));
      } catch (error) {
        throw new Error(
          `Could not find valid requirements.txt file at ${packages}. Libraries must be specified as a list of valid package names or a path to a requirements.txt file.`
        );
      }
    } else {
      packageList = packages;
    }

    for (const pkg of packageList) {
      this.buildSteps.push({ command: pkg, type: "pip" });
    }
    return this;
  }

  /**
   * Add a local path to the image. 
   * 
   * @param pattern The pattern to add. This can be a glob pattern or a single file.
   * @returns The image instance.
   */
  addLocalPath(pattern: string = "*"): Image {
    let processedPath = pattern;
    if (pattern === ".") {
      processedPath = "*";
    }
    this.includeFilesPatterns.push(processedPath);
    return this;
  }

  /**
   * Add environment variables to the image.
   * 
   * These will be available when building the image and when the container is running.
   * 
   * @param envVars Environment variables. This can be a string, a list of strings, or a
   * dictionary of strings. The string must be in the format of "KEY=VALUE". If a list of
   * strings is provided, each element should be in the same format. Default is None.
   * @param clear Clear existing environment variables before adding the new ones.
   * @returns The image instance.
   */
  withEnvs(envVars: string[] | Record<string, string> | string, clear: boolean = false): Image {
    let envList: string[];

    if (typeof envVars === "object" && !Array.isArray(envVars)) {
      envList = Object.entries(envVars).map(([key, value]) => `${key}=${value}`);
    } else if (typeof envVars === "string") {
      envList = [envVars];
    } else {
      envList = envVars;
    }

    this._validateEnvVars(envList);

    if (clear) {
      this.envVars = [];
    }

    this.envVars.push(...envList);
    return this;
  }

  /**
   * Add secrets stored in the platform to the build environment.
   * 
   * @param secrets The secrets to add.
   * @returns The image instance.
   */
  withSecrets(secrets: string[]): Image {
    this.secrets.push(...secrets);
    return this;
  }

  /**
   * Build the image on a GPU node.
   * 
   * @param gpu The GPU type to use.
   * @returns The image instance.
   */
  buildWithGpu(gpu: GpuType): Image {
    this.gpu = gpu;
    return this;
  }

  /**
   * Sync files using FileSyncer
   */
  async syncFiles(contextDir?: string, cacheObjectId: boolean = true): Promise<string> {
    const { FileSyncer } = await import('../sync');
    const syncer = new FileSyncer(this.manager.client, contextDir || "./");
    const result = await syncer.sync([], [], cacheObjectId);
    
    if (!result.success) {
      throw new Error('File sync failed');
    }
    
    return result.object_id;
  }

  getCredentialsFromEnv(): Record<string, string> {
    if (typeof process === "undefined") {
      return {}; // Browser environment
    }

    const keys = Object.keys(this.baseImageCreds);
    const creds: Record<string, string> = {};

    for (const key of keys) {
      const value = process.env[key];
      if (value) {
        creds[key] = value;
      } else {
        throw new ImageCredentialValueNotFound(key);
      }
    }

    return creds;
  }

  private _sanitizePythonPackages(packages: string[]): string[] {
    const prefixExceptions = ["--", "-"];
    const sanitized: string[] = [];

    for (const pkg of packages) {
      if (prefixExceptions.some(prefix => pkg.startsWith(prefix))) {
        sanitized.push(pkg);
      } else if (pkg.startsWith("#")) {
        continue;
      } else {
        sanitized.push(pkg.replace(/\s+/g, ""));
      }
    }

    return sanitized;
  }

  private _loadRequirementsFile(filePath: string): string[] {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);
      return lines;
    } catch (error) {
      throw new Error(`File not found: ${filePath}`);
    }
  }

  private _processCredentials(creds: ImageCredentials): Record<string, string> {
    if (Array.isArray(creds)) {
      // List of environment variable keys
      const result: Record<string, string> = {};
      for (const key of creds) {
        result[key] = ""; // Will be filled from env vars during build
      }
      return result;
    } else {
      // Direct credential object
      return creds as Record<string, string>;
    }
  }

  private _validateEnvVars(envVars: string[]): void {
    for (const envVar of envVars) {
      const parts = envVar.split("=");
      if (parts.length !== 2) {
        throw new Error(`Environment variable must contain '=': ${envVar}`);
      }
      const [key, value] = parts;
      if (!key) {
        throw new Error(`Environment variable key cannot be empty: ${envVar}`);
      }
      if (!value) {
        throw new Error(`Environment variable value cannot be empty: ${envVar}`);
      }
    }
  }
}
