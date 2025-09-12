import * as fs from "fs";
import * as path from "path";
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
} from "../../types/image";
import { camelCaseToSnakeCaseKeys } from "../../util";
import beamClient from "../..";

const DEFAULT_PYTHON_VERSION: PythonVersion = PythonVersion.Python3;

const defaultConfig: ImageConfig = {
  pythonVersion: DEFAULT_PYTHON_VERSION,
  pythonPackages: [],
  commands: [],
  buildSteps: [],
  baseImage: "",
  baseImageCreds: {},
  envVars: [],
  secrets: [],
  dockerfile: "",
  gpu: "",
  ignorePython: false,
  includeFilesPatterns: [],
  buildCtxObject: "",
  snapshotId: "",
};

export class Image {
  public data: ImageData;
  public config: ImageConfig = defaultConfig;
  public isAvailable: boolean = false;

  constructor(config: ImageConfig = defaultConfig) {
    this.data = {
      id: "",
    } as ImageData;

    this.config.pythonVersion = config.pythonVersion;
    if (typeof config.pythonPackages === "string") {
      config.pythonPackages = this._loadRequirementsFile(config.pythonPackages);
    }
    this.config.pythonPackages = this._sanitizePythonPackages(
      config.pythonPackages
    );

    this.config.commands = config.commands;
    this.config.baseImage = config.baseImage;
    this.config.baseImageCreds = this._processCredentials(
      config.baseImageCreds
    );
    this.config.envVars = config.envVars;
    this.config.secrets = config.secrets;
    this.config.dockerfile = config.dockerfile;
    this.config.gpu = config.gpu;
    this.config.ignorePython = config.ignorePython;
    this.config.includeFilesPatterns = config.includeFilesPatterns;
    this.config.buildCtxObject = config.buildCtxObject;
    this.config.snapshotId = config.snapshotId;
  }

  static async fromDockerfile(
    dockerfilePath: string,
    contextDir?: string
  ): Promise<Image> {
    const image = new Image({
      ...defaultConfig,
      dockerfile: dockerfilePath,
    });

    if (!contextDir) {
      contextDir = path.dirname(dockerfilePath);
    }

    try {
      // Sync files to get build context object ID
      console.log(`Syncing build context from: ${contextDir}`);
      const objectId = await image.syncFiles(contextDir);
      image.config.buildCtxObject = objectId;
      console.log(`Build context synced with object ID: ${objectId}`);
    } catch (error) {
      throw new Error(`Failed to sync build context: ${error}`);
    }

    try {
      const dockerfile = fs.readFileSync(dockerfilePath, "utf8");
      image.config.dockerfile = dockerfile;
    } catch (error) {
      throw new Error(
        `Failed to read Dockerfile at ${dockerfilePath}: ${error}`
      );
    }

    return image;
  }

  static fromRegistry(imageUri: string, credentials?: ImageCredentials): Image {
    return new Image({
      ...defaultConfig,
      baseImage: imageUri,
      baseImageCreds: credentials || {},
    });
  }

  public async buildImage(
    request: BuildImageRequest
  ): Promise<AsyncIterable<BuildImageResponse>> {
    const apiRequest = this._transformRequestToSnakeCase(request);

    const response = await beamClient.request({
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

  private async *_createAsyncIterable(
    response: any
  ): AsyncIterable<BuildImageResponse> {
    const stream = response.data;
    let buffer = "";

    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine) {
          try {
            const jsonResponse = JSON.parse(trimmedLine).result;
            yield jsonResponse as BuildImageResponse;
          } catch (error) {
            console.warn("Failed to parse JSON line:", trimmedLine, error);
          }
        }
      }
    }

    if (buffer.trim()) {
      try {
        const jsonResponse = JSON.parse(buffer.trim()).result;
        yield jsonResponse as BuildImageResponse;
      } catch (error) {
        console.warn("Failed to parse final JSON:", buffer, error);
      }
    }
  }

  public async verifyImageBuild(
    request: VerifyImageBuildRequest
  ): Promise<VerifyImageBuildResponse> {
    const apiRequest = this._transformRequestToSnakeCase(request);

    const response = await beamClient.request({
      method: "POST",
      url: "/api/v1/gateway/images/verify-build",
      data: apiRequest,
    });

    return response.data;
  }

  static fromSnapshot(snapshotId: string): Image {
    const image = new Image({
      ...defaultConfig,
    });
    image.config.snapshotId = snapshotId;
    return image;
  }

  async exists(): Promise<{ exists: boolean; result: ImageBuildResult }> {
    const request: VerifyImageBuildRequest = {
      pythonPackages: Array.isArray(this.config.pythonPackages)
        ? this.config.pythonPackages
        : [this.config.pythonPackages],
      pythonVersion: this.config.pythonVersion,
      commands: this.config.commands,
      forceRebuild: false,
      existingImageUri: this.config.baseImage,
      envVars: this._processEnvVars(this.config.envVars),
      dockerfile: this.config.dockerfile,
      buildCtxObject: this.config.buildCtxObject,
      secrets: this.config.secrets,
      gpu: this.config.gpu,
      ignorePython: this.config.ignorePython,
      snapshotId: this.config.snapshotId,
    };

    const response = await this.verifyImageBuild(request);

    return {
      exists: response.exists || false,
      result: {
        success: response.exists || false,
        imageId: response.imageId,
        pythonVersion: this.config.pythonVersion,
      },
    };
  }

  async build(): Promise<ImageBuildResult> {
    console.log("Building image...");

    if (this.config.baseImage && this.config.dockerfile) {
      throw new Error(
        "Cannot use fromDockerfile and provide a custom base image."
      );
    }

    // Check if image already exists
    const { exists, result } = await this.exists();
    if (exists) {
      console.log("Using cached image");
      return result;
    }

    const request: BuildImageRequest = {
      pythonPackages: Array.isArray(this.config.pythonPackages)
        ? this.config.pythonPackages
        : [this.config.pythonPackages],
      pythonVersion: this.config.pythonVersion,
      commands: this.config.commands,
      existingImageUri: this.config.baseImage,
      existingImageCreds: this.getCredentialsFromEnv(),
      envVars: this._processEnvVars(this.config.envVars),
      dockerfile: this.config.dockerfile,
      buildCtxObject: this.config.buildCtxObject,
      secrets: this.config.secrets,
      gpu: this.config.gpu,
      ignorePython: this.config.ignorePython,
    };

    let lastResponse: BuildImageResponse = { success: false };

    try {
      const responseIterable = await this.buildImage(request);
      for await (const response of responseIterable) {
        if (response.warning) {
          console.warn("WARNING: " + response.msg);
        } else if (response.msg && !response.done) {
          if (typeof process !== "undefined" && process.stdout) {
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
    if (this.config.pythonVersion === "python3") {
      this.config.pythonVersion = "python3.11";
    }
    this.config.pythonVersion = this.config.pythonVersion.replace(
      "python",
      "micromamba"
    );
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
  addMicromambaPackages(
    packages: string[] | string,
    channels: string[] = []
  ): Image {
    if (!this.config.pythonVersion.startsWith("micromamba")) {
      throw new Error("Micromamba must be enabled to use this method.");
    }

    let packageList: string[];
    if (typeof packages === "string") {
      packageList = this._sanitizePythonPackages(
        this._loadRequirementsFile(packages)
      );
    } else {
      packageList = packages;
    }

    return this;
  }

  addPythonPackages(packages: string[] | string): Image {
    let packageList: string[];
    if (typeof packages === "string") {
      try {
        packageList = this._sanitizePythonPackages(
          this._loadRequirementsFile(packages)
        );
      } catch (error) {
        throw new Error(
          `Could not find valid requirements.txt file at ${packages}. Libraries must be specified as a list of valid package names or a path to a requirements.txt file.`
        );
      }
    } else {
      packageList = packages;
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
    this.config.includeFilesPatterns.push(processedPath);
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
  withEnvs(envVars: string[] | Record<string, string> | string): Image {
    let envList: string[];

    if (typeof envVars === "object" && !Array.isArray(envVars)) {
      envList = Object.entries(envVars).map(
        ([key, value]) => `${key}=${value}`
      );
    } else if (typeof envVars === "string") {
      envList = [envVars];
    } else {
      envList = envVars;
    }

    this._validateEnvVars(envList);
    this.config.envVars = envList;
    return this;
  }

  /**
   * Add secrets stored in the platform to the build environment.
   *
   * @param secrets The secrets to add.
   * @returns The image instance.
   */
  withSecrets(secrets: string[]): Image {
    this.config.secrets.push(...secrets);
    return this;
  }

  /**
   * Build the image on a GPU node.
   *
   * @param gpu The GPU type to use.
   * @returns The image instance.
   */
  buildWithGpu(gpu: GpuType): Image {
    this.config.gpu = gpu;
    return this;
  }

  /**
   * Sync files using FileSyncer
   */
  async syncFiles(
    contextDir?: string,
    cacheObjectId: boolean = true
  ): Promise<string> {
    const { FileSyncer } = await import("../../sync");
    const syncer = new FileSyncer(contextDir || "./");
    const result = await syncer.sync([], [], cacheObjectId);

    if (!result.success) {
      throw new Error("File sync failed");
    }

    return result.object_id;
  }

  getCredentialsFromEnv(): Record<string, string> {
    if (typeof process === "undefined") {
      return {}; // Browser environment
    }

    const keys = Object.keys(this.config.baseImageCreds);
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
      if (prefixExceptions.some((prefix) => pkg.startsWith(prefix))) {
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
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
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
        throw new Error(
          `Environment variable value cannot be empty: ${envVar}`
        );
      }
    }
  }

  private _processEnvVars(
    envVars: string[] | Record<string, string> | string
  ): string[] {
    if (typeof envVars === "object" && !Array.isArray(envVars)) {
      return Object.entries(envVars).map(([key, value]) => `${key}=${value}`);
    } else if (typeof envVars === "string") {
      return [envVars];
    } else {
      return envVars;
    }
  }
}
