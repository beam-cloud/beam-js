import * as fs from "fs";
import { Pod, PodInstance } from "./pod";
import { CreateStubConfig } from "./stub";
import { EStubType } from "../../types/stub";
import type {
  PodSandboxSnapshotResponse,
  PodSandboxUpdateTtlResponse,
  PodSandboxExposePortResponse,
  PodSandboxExecResponse,
  PodSandboxListFilesResponse,
  PodSandboxCreateDirectoryResponse,
  PodInstanceData,
} from "../../types/pod";
import beamClient from "../..";

/** Error thrown when connecting to a sandbox fails. */
export class SandboxConnectionError extends Error {}
/** Error thrown for sandbox filesystem operations. */
export class SandboxFileSystemError extends Error {}
/** Error thrown for sandbox process operations. */
export class SandboxProcessError extends Error {}

function shellQuote(arg: string): string {
  if (arg === "") return "''";
  // Simple POSIX single-quote escaping
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * A sandboxed container for running code or arbitrary processes.
 * You can use this to create isolated environments where you can execute code,
 * manage files, and run processes.
 *
 * Parameters:
 * - cpu (number | string): The number of CPU cores allocated to the container. Default is 1.0.
 * - memory (number | string): The amount of memory allocated to the container. It should be specified in
 *   MiB, or as a string with units (e.g. "1Gi"). Default is 128 MiB.
 * - gpu (GpuType | GpuType[]): The type or name of the GPU device to be used for GPU-accelerated tasks. If not
 *   applicable or no GPU required, leave it empty. Default is GpuType.NoGPU.
 * - gpu_count (number): The number of GPUs to allocate. Default is 0.
 * - image (Image): The container image used for the task execution. Whatever you pass here will have an additional `add_python_packages` call
 *   with ["fastapi", "vllm", "huggingface_hub"] added to it to ensure that we can run vLLM in the container. (Note: image manipulation must be done by the caller in JS SDK.)
 * - keep_warm_seconds (number): The number of seconds to keep the sandbox around. Default is 10 minutes (600s). Use -1 for sandboxes that never timeout.
 * - authorized (boolean): Whether the sandbox should be authorized for external access. Default is false.
 * - name (string | undefined): The name of the Sandbox app. Default is none, which means you must provide it during deployment.
 * - volumes (any[]): The volumes and/or cloud buckets to mount into the Sandbox container. Default is an empty list.
 * - secrets (string[]): The secrets to pass to the Sandbox container.
 * - sync_local_dir (boolean): Whether to sync the local directory to the sandbox filesystem on creation. Default is false.
 */
export class Sandbox extends Pod {
  public syncLocalDir: boolean = false;

  constructor(config: CreateStubConfig, syncLocalDir: boolean = false) {
    super(config);
    this.syncLocalDir = syncLocalDir;
  }

  /**
   * Connect to an existing sandbox instance by ID.
   *
   * Parameters:
   * - id (string): The container ID of the existing sandbox instance.
   *
   * Returns: SandboxInstance - A connected sandbox instance.
   *
   * Throws: SandboxConnectionError if the connection fails.
   */
  public async connect(id: string): Promise<SandboxInstance> {
    const resp = await beamClient.request({
      method: "POST",
      url: `api/v1/gateway/pods/${id}/connect`,
      data: {},
    });

    const data = resp.data as {
      ok: boolean;
      errorMsg?: string;
      stubId?: string;
    };
    if (!data.ok) {
      throw new SandboxConnectionError(
        data.errorMsg || "Failed to connect to sandbox"
      );
    }

    return new SandboxInstance(
      {
        containerId: id,
        url: "",
        ok: true,
        errorMsg: "",
        stubId: data.stubId || "",
      },
      this
    );
  }

  /**
   * Create a sandbox instance from a filesystem snapshot.
   *
   * Parameters:
   * - snapshotId (string): The ID of the snapshot to create the sandbox from.
   *
   * Returns: SandboxInstance - A new sandbox instance ready for use.
   */
  public async create_from_snapshot(
    snapshotId: string
  ): Promise<SandboxInstance> {
    const parts = snapshotId.split("-");
    const stubId = parts.slice(1, 6).join("-");

    // eslint-disable-next-line no-console
    console.log(`Creating sandbox from snapshot: ${snapshotId}`);

    const createResp = await beamClient.request({
      method: "POST",
      url: `api/v1/gateway/pods`,
      data: { stubId, snapshotId },
    });
    const body = createResp.data as {
      ok: boolean;
      containerId: string;
      errorMsg?: string;
    };

    if (!body.ok) {
      return new SandboxInstance(
        {
          stubId,
          containerId: "",
          url: "",
          ok: false,
          errorMsg: body.errorMsg || "",
        },
        this
      );
    }

    // eslint-disable-next-line no-console
    console.log(`Sandbox created successfully ===> ${body.containerId}`);

    if ((this.stub.config.keepWarmSeconds as number) < 0) {
      // eslint-disable-next-line no-console
      console.log(
        "This sandbox has no timeout, it will run until it is shut down manually."
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `This sandbox will timeout after ${this.stub.config.keepWarmSeconds} seconds.`
      );
    }

    return new SandboxInstance(
      {
        stubId,
        containerId: body.containerId,
        url: "",
        ok: body.ok,
        errorMsg: body.errorMsg || "",
      },
      this
    );
  }

  /**
   * Create a new sandbox instance.
   *
   * This method creates a new containerized sandbox environment with the
   * specified configuration.
   *
   * Returns: SandboxInstance - A new sandbox instance ready for use.
   */
  public async create(entrypoint?: string[]): Promise<SandboxInstance> {
    this.stub.config.entrypoint = ["tail", "-f", "/dev/null"];
    if (entrypoint && entrypoint.length) {
      this.stub.config.entrypoint = entrypoint;
    }

    const ignorePatterns = this.syncLocalDir ? undefined : ["*"];

    const prepared = await this.stub.prepareRuntime(
      undefined,
      EStubType.Sandbox,
      true,
      ignorePatterns
    );
    if (!prepared) {
      return new SandboxInstance(
        {
          containerId: "",
          url: "",
          ok: false,
          errorMsg: "Failed to prepare runtime",
          stubId: "",
        },
        this
      );
    }

    // eslint-disable-next-line no-console
    console.log("Creating sandbox");

    const createResp = await beamClient.request({
      method: "POST",
      url: `api/v1/gateway/pods`,
      data: { stubId: this.stub.stubId },
    });
    const body = createResp.data as {
      ok: boolean;
      containerId: string;
      errorMsg?: string;
    };

    if (!body.ok) {
      return new SandboxInstance(
        {
          stubId: this.stub.stubId!,
          containerId: "",
          url: "",
          ok: false,
          errorMsg: body.errorMsg || "",
        },
        this
      );
    }

    // eslint-disable-next-line no-console
    console.log(`Sandbox created successfully ===> ${body.containerId}`);

    if ((this.stub.config.keepWarmSeconds as number) < 0) {
      // eslint-disable-next-line no-console
      console.log(
        "This sandbox has no timeout, it will run until it is shut down manually."
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `This sandbox will timeout after ${this.stub.config.keepWarmSeconds} seconds.`
      );
    }

    return new SandboxInstance(
      {
        stubId: this.stub.stubId!,
        containerId: body.containerId,
        ok: body.ok,
        errorMsg: body.errorMsg || "",
        url: "",
      },
      this
    );
  }
}

/**
 * A sandbox instance that provides access to the sandbox internals.
 *
 * This class represents an active sandboxed container and provides methods for
 * process management, file system operations, preview URLs, and lifecycle
 * management.
 *
 * Attributes:
 * - container_id (string): The unique ID of the created sandbox container.
 * - fs (SandboxFileSystem): File system interface for the sandbox.
 * - processes (Record<number, SandboxProcess>): Map of running processes by PID.
 *
 * Process Management Methods:
 * - run_code(code, blocking?, cwd?, env?): Execute Python code in the sandbox.
 * - exec(...args): Run arbitrary commands in the sandbox.
 * - list_processes(): Get all running processes.
 * - get_process(pid): Get a specific process by PID.
 */
export class SandboxInstance extends PodInstance {
  public stubId: string;
  public fs: SandboxFileSystem;
  public processes: Record<number, SandboxProcess> = {};
  public terminated: boolean = false;

  constructor(data: { stubId: string } & PodInstanceData, pod: Pod) {
    super(data, pod);
    this.stubId = data.stubId;
    this.fs = new SandboxFileSystem(this);
  }

  /**
   * Create a snapshot of the sandbox filesystem.
   *
   * Returns: string - The snapshot ID.
   */
  public async snapshot(): Promise<string> {
    // eslint-disable-next-line no-console
    console.log(`Creating snapshot of: ${this.containerId}`);

    const resp = await beamClient.request({
      method: "POST",
      url: `/api/v1/gateway/pods/${this.containerId}/snapshot`,
      data: { stubId: this.stubId },
    });
    const data = resp.data as PodSandboxSnapshotResponse;
    if (!data.ok)
      throw new SandboxProcessError(data.errorMsg || "Failed to snapshot");
    return data.snapshotId;
  }

  /** Get the ID of the sandbox. */
  public get sandboxId(): string {
    return this.containerId;
  }

  /**
   * Update the keep warm setting of the sandbox.
   *
   * Parameters: ttl (number): The number of seconds to keep the sandbox alive. Use -1 for never timeout.
   */
  public async update_ttl(ttl: number): Promise<void> {
    const resp = await beamClient.request({
      method: "PATCH",
      url: `/api/v1/gateway/pods/${this.containerId}/ttl`,
      data: { ttl },
    });
    const data = resp.data as PodSandboxUpdateTtlResponse;
    if (!data.ok)
      throw new SandboxProcessError(data.errorMsg || "Failed to update TTL");
  }

  /**
   * Dynamically expose a port to the internet. Returns the public URL.
   */
  public async expose_port(port: number): Promise<string> {
    const resp = await beamClient.request({
      method: "POST",
      url: `/api/v1/gateway/pods/${this.containerId}/ports/expose`,
      data: { stubId: this.stubId, port },
    });
    const data = resp.data as PodSandboxExposePortResponse;
    if (data.ok && data.url) return data.url;
    throw new SandboxProcessError(data.errorMsg || "Failed to expose port");
  }

  /**
   * Run Python code in the sandbox.
   *
   * Parameters:
   * - code (string): The Python code to execute.
   * - blocking (boolean): Wait for completion and return response; otherwise return a SandboxProcess.
   * - cwd (string | undefined): Working directory.
   * - env (Record<string,string> | undefined): Environment variables.
   */
  public async run_code(
    code: string,
    blocking: boolean = true,
    cwd?: string,
    env?: Record<string, string>
  ): Promise<SandboxProcessResponse | SandboxProcess> {
    const process = await this._exec(["python3", "-c", code], { cwd, env });
    if (blocking) {
      await process.wait();
      const [stdoutStr, stderrStr] = await Promise.all([
        process.stdout.readAll(),
        process.stderr.readAll(),
      ]);
      return {
        pid: process.pid,
        exit_code: process.exit_code,
        stdout: stdoutStr,
        stderr: stderrStr,
        result: stdoutStr + stderrStr,
      };
    }
    return process;
  }

  /** Run an arbitrary command in the sandbox. */
  public async exec(...args: string[]): Promise<SandboxProcess> {
    return this._exec(args);
  }

  private async _exec(
    command: string[] | string,
    opts?: { cwd?: string; env?: Record<string, string> }
  ): Promise<SandboxProcess> {
    const commandList = Array.isArray(command) ? command : [command];
    const shellCommand = commandList
      .map((a) => shellQuote(String(a)))
      .join(" ");

    const resp = await beamClient.request({
      method: "POST",
      url: `/api/v1/gateway/pods/${this.containerId}/exec`,
      data: {
        command: shellCommand,
        cwd: opts?.cwd,
        env: opts?.env,
      },
    });
    const data = resp.data as PodSandboxExecResponse;
    if (!data.ok || !data.pid || data.pid <= 0) {
      throw new SandboxProcessError(data.errorMsg || "Failed to start process");
    }

    const process = new SandboxProcess(this, data.pid);
    this.processes[data.pid] = process;
    return process;
  }

  /** List all processes running in the sandbox. */
  public list_processes(): SandboxProcess[] {
    return Object.values(this.processes);
  }

  /** Get a process by its PID. */
  public get_process(pid: number): SandboxProcess {
    const proc = this.processes[pid];
    if (!proc)
      throw new SandboxProcessError(`Process with pid ${pid} not found`);
    return proc;
  }
}

/**
 * Response object containing the results of a completed process execution.
 *
 * This class encapsulates the output and status information from a process
 * that has finished running in the sandbox.
 *
 * Attributes:
 * - pid (number): The process ID of the executed command.
 * - exit_code (number): The exit code of the process (0 typically indicates success).
 * - stdout (string): The full standard output captured for the process.
 * - stderr (string): The full standard error output captured for the process.
 * - result (string): Combined stdout and stderr output as a string.
 */
export interface SandboxProcessResponse {
  pid: number;
  exit_code: number;
  stdout: string;
  stderr: string;
  result: string;
}

/**
 * A stream-like interface for reading process output in real-time.
 *
 * Provides an iterator interface and bulk reading capabilities.
 */
export class SandboxProcessStream {
  public process: SandboxProcess;
  private fetch_fn: () => Promise<string> | string;
  private _buffer: string = "";
  private _closed: boolean = false;
  private _last_output: string = "";

  constructor(
    process: SandboxProcess,
    fetch_fn: () => Promise<string> | string
  ) {
    this.process = process;
    this.fetch_fn = fetch_fn;
  }

  public [Symbol.asyncIterator](): AsyncIterableIterator<string> {
    const self = this;
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      async next() {
        while (true) {
          if (self._buffer.includes("\n")) {
            const [line, rest] = self._buffer.split("\n", 1);
            self._buffer = rest;
            return { value: line + "\n", done: false };
          }

          if (self._closed) {
            if (self._buffer) {
              const line = self._buffer;
              self._buffer = "";
              return { value: line, done: false };
            }
            return { value: undefined as any, done: true };
          }

          const chunk = await self._fetch_next_chunk();
          if (chunk) {
            self._buffer += chunk;
          } else {
            const [exitCode] = await self.process.status();
            if (exitCode >= 0) {
              const lastChunk = await self._fetch_next_chunk();
              if (lastChunk) {
                self._buffer += lastChunk;
                continue;
              }
              self._closed = true;
            } else {
              await new Promise((r) => setTimeout(r, 100));
            }
          }
        }
      },
    } as AsyncIterableIterator<string>;
  }

  private async _fetch_next_chunk(): Promise<string> {
    const output =
      typeof this.fetch_fn === "function" ? await this.fetch_fn() : "";
    if (output === this._last_output) return "";
    const newOutput = output.slice(this._last_output.length);
    this._last_output = output;
    return newOutput;
  }

  /** Return whatever output is currently available in the stream. */
  public read(): string {
    let data = this._buffer;
    this._buffer = "";
    // Intentionally non-async; best-effort immediate read
    return data;
  }

  /**
   * Fetch and return all available output at this moment.
   */
  public async readAll(): Promise<string> {
    let data = this._buffer;
    this._buffer = "";
    while (true) {
      const chunk = await this._fetch_next_chunk();
      if (chunk) {
        data += chunk;
      } else {
        break;
      }
    }
    return data;
  }
}

/**
 * Represents a running process within a sandbox.
 *
 * Control and monitoring capabilities for processes running in the sandbox.
 */
export class SandboxProcess {
  public sandbox_instance: SandboxInstance;
  public pid: number;
  public exit_code: number = -1;
  private _status: string = "";

  constructor(sandbox_instance: SandboxInstance, pid: number) {
    this.sandbox_instance = sandbox_instance;
    this.pid = pid;
  }

  /** Wait for the process to complete and return the exit code. */
  public async wait(): Promise<number> {
    [this.exit_code, this._status] = await this.status();
    while (this.exit_code < 0) {
      [this.exit_code, this._status] = await this.status();
      await new Promise((r) => setTimeout(r, 100));
    }
    return this.exit_code;
  }

  /** Kill the process. */
  public async kill(): Promise<void> {
    const resp = await beamClient.request({
      method: "POST",
      url: `api/v1/gateway/pods/${this.sandbox_instance.containerId}/kill`,
      data: { pid: this.pid },
    });
    const data = resp.data as { ok: boolean; errorMsg?: string };
    if (!data.ok)
      throw new SandboxProcessError(data.errorMsg || "Failed to kill process");
  }

  /** Get the status of the process: [exit_code, status]. */
  public async status(): Promise<[number, string]> {
    const resp = await beamClient.request({
      method: "GET",
      url: `api/v1/gateway/pods/${this.sandbox_instance.containerId}/status`,
      params: { pid: this.pid },
    });
    const data = resp.data as {
      ok: boolean;
      errorMsg?: string;
      status?: string;
      exitCode?: number;
    };
    if (!data.ok)
      throw new SandboxProcessError(data.errorMsg || "Failed to get status");
    return [data.exitCode ?? -1, data.status || ""];
  }

  /** Get a handle to a stream of the process's stdout. */
  public get stdout(): SandboxProcessStream {
    return new SandboxProcessStream(this, async () => {
      const resp = await beamClient.request({
        method: "GET",
        url: `api/v1/gateway/pods/${this.sandbox_instance.containerId}/stdout`,
        params: { pid: this.pid },
      });
      const data = resp.data as { ok: boolean; stdout?: string };
      return data.stdout || "";
    });
  }

  /** Get a handle to a stream of the process's stderr. */
  public get stderr(): SandboxProcessStream {
    return new SandboxProcessStream(this, async () => {
      const resp = await beamClient.request({
        method: "GET",
        url: `api/v1/gateway/pods/${this.sandbox_instance.containerId}/stderr`,
        params: { pid: this.pid },
      });
      const data = resp.data as { ok: boolean; stderr?: string };
      return data.stderr || "";
    });
  }

  /** Returns a combined stream of both stdout and stderr. */
  public get logs() {
    const self = this;
    class CombinedStream {
      _stdout = self.stdout;
      _stderr = self.stderr;
      _queue: string[] = [];
      _stdoutBuffer = "";
      _stderrBuffer = "";
      _stdoutExhausted = false;
      _stderrExhausted = false;

      async _process_stream(streamName: "stdout" | "stderr") {
        const isStdout = streamName === "stdout";
        const stream = isStdout ? this._stdout : this._stderr;
        const chunk = await (stream as any)._fetch_next_chunk();
        if (chunk) {
          if (isStdout) this._stdoutBuffer += chunk;
          else this._stderrBuffer += chunk;
          while (
            (isStdout ? this._stdoutBuffer : this._stderrBuffer).includes("\n")
          ) {
            const parts = (
              isStdout ? this._stdoutBuffer : this._stderrBuffer
            ).split("\n");
            const line = parts.shift()!;
            if (isStdout) this._stdoutBuffer = parts.join("\n");
            else this._stderrBuffer = parts.join("\n");
            this._queue.push(line + "\n");
          }
        } else {
          const [exitCode] = await self.status();
          if (exitCode >= 0) {
            const buf = isStdout ? this._stdoutBuffer : this._stderrBuffer;
            if (buf) {
              this._queue.push(buf);
              if (isStdout) this._stdoutBuffer = "";
              else this._stderrBuffer = "";
              return;
            }
            if (isStdout) this._stdoutExhausted = true;
            else this._stderrExhausted = true;
          }
        }
      }

      async _fill_queue() {
        await this._process_stream("stdout");
        await this._process_stream("stderr");
      }

      public [Symbol.asyncIterator](): AsyncIterableIterator<string> {
        const that = this;
        return {
          [Symbol.asyncIterator]() {
            return this;
          },
          async next() {
            while (true) {
              if (!that._queue.length) {
                await that._fill_queue();
                if (
                  !that._queue.length &&
                  that._stdoutExhausted &&
                  that._stderrExhausted
                ) {
                  return { value: undefined as any, done: true };
                }
                if (!that._queue.length) {
                  await new Promise((r) => setTimeout(r, 100));
                  continue;
                }
              }
              return { value: that._queue.shift()!, done: false };
            }
          },
        } as AsyncIterableIterator<string>;
      }

      public read(): string {
        return self.stdout.read() + self.stderr.read();
      }
    }
    return new CombinedStream();
  }
}

/** Metadata of a file in the sandbox. */
export class SandboxFileInfo {
  public name: string;
  public is_dir: boolean;
  public size: number;
  public mode: number;
  public mod_time: number;
  public permissions: number;
  public owner: string;
  public group: string;

  constructor(init: {
    name: string;
    is_dir: boolean;
    size: number;
    mode: number;
    mod_time: number;
    permissions: number;
    owner: string;
    group: string;
  }) {
    this.name = init.name;
    this.is_dir = init.is_dir;
    this.size = init.size;
    this.mode = init.mode;
    this.mod_time = init.mod_time;
    this.permissions = init.permissions;
    this.owner = init.owner;
    this.group = init.group;
  }

  public toString(): string {
    const octal = (this.permissions & 0o7777).toString(8);
    return `SandboxFileInfo(name='${this.name}', is_dir=${this.is_dir}, size=${this.size}, mode=${this.mode}, mod_time=${this.mod_time}, permissions=${octal}, owner='${this.owner}', group='${this.group}')`;
  }
}

/** A position in a file. */
export class SandboxFilePosition {
  constructor(public line: number, public column: number) {}
}
/** A range in a file. */
export class SandboxFileSearchRange {
  constructor(
    public start: SandboxFilePosition,
    public end: SandboxFilePosition
  ) {}
}
/** A match in a file. */
export class SandboxFileSearchMatch {
  constructor(public range: SandboxFileSearchRange, public content: string) {}
}
/** A search result in a file. */
export class SandboxFileSearchResult {
  constructor(public path: string, public matches: SandboxFileSearchMatch[]) {}
}

/**
 * File system interface for managing files within a sandbox.
 *
 * Upload, download, stat, list, and manage files and directories.
 */
export class SandboxFileSystem {
  private sandbox_instance: SandboxInstance;
  constructor(sandbox_instance: SandboxInstance) {
    this.sandbox_instance = sandbox_instance;
  }

  /** Upload a local file to the sandbox. */
  public async upload_file(
    local_path: string,
    sandbox_path: string
  ): Promise<void> {
    const content = fs.readFileSync(local_path);
    const resp = await beamClient.request({
      method: "POST",
      url: `api/v1/gateway/pods/${this.sandbox_instance.containerId}/files/upload`,
      data: {
        containerPath: sandbox_path,
        mode: 0o644,
        data: content.toString("base64"),
      },
    });
    const data = resp.data as { ok: boolean; errorMsg?: string };
    if (!data.ok)
      throw new SandboxFileSystemError(
        data.errorMsg || "Failed to upload file"
      );
  }

  /** Download a file from the sandbox to a local path. */
  public async download_file(
    sandbox_path: string,
    local_path: string
  ): Promise<void> {
    const resp = await beamClient.request({
      method: "GET",
      url: `api/v1/gateway/pods/${
        this.sandbox_instance.containerId
      }/files/download/${encodeURIComponent(sandbox_path)}`,
    });
    const data = resp.data as { ok: boolean; errorMsg?: string; data?: string };
    if (!data.ok || !data.data)
      throw new SandboxFileSystemError(
        data.errorMsg || "Failed to download file"
      );
    const buf = Buffer.from(data.data, "base64");
    fs.writeFileSync(local_path, buf);
  }

  /** Get the metadata of a file in the sandbox. */
  public async stat_file(sandbox_path: string): Promise<SandboxFileInfo> {
    const resp = await beamClient.request({
      method: "GET",
      url: `api/v1/gateway/pods/${this.sandbox_instance.containerId}/files/stat`,
      params: { containerPath: sandbox_path },
    });
    const data = resp.data as {
      ok: boolean;
      errorMsg?: string;
      fileInfo?: any;
    };
    if (!data.ok || !data.fileInfo)
      throw new SandboxFileSystemError(data.errorMsg || "Failed to stat file");
    return new SandboxFileInfo({
      name: data.fileInfo.name,
      is_dir: data.fileInfo.isDir,
      size: Number(data.fileInfo.size),
      mode: Number(data.fileInfo.mode),
      mod_time: Number(data.fileInfo.modTime),
      owner: data.fileInfo.owner,
      group: data.fileInfo.group,
      permissions: Number(data.fileInfo.permissions),
    });
  }

  /** List the files in a directory in the sandbox. */
  public async list_files(sandbox_path: string): Promise<SandboxFileInfo[]> {
    const resp = await beamClient.request({
      method: "GET",
      url: `/api/v1/gateway/pods/${this.sandbox_instance.containerId}/files`,
      params: { containerPath: sandbox_path },
    });
    const data = resp.data as PodSandboxListFilesResponse;
    if (!data.ok || !data.files)
      throw new SandboxFileSystemError(data.errorMsg || "Failed to list files");
    return data.files.map(
      (file: any) =>
        new SandboxFileInfo({
          name: file.name,
          is_dir: !!file.isDir,
          size: Number(file.size),
          mode: Number(file.mode),
          mod_time: Number(file.modTime),
          owner: file.owner,
          group: file.group,
          permissions: Number(file.permissions),
        })
    );
  }

  /** Create a directory in the sandbox. */
  public async create_directory(sandbox_path: string): Promise<void> {
    const resp = await beamClient.request({
      method: "POST",
      url: `/api/v1/gateway/pods/${this.sandbox_instance.containerId}/directories`,
      data: { containerPath: sandbox_path, mode: 0o755 },
    });
    const data = resp.data as PodSandboxCreateDirectoryResponse;
    if (!data.ok)
      throw new SandboxFileSystemError(
        data.errorMsg || "Failed to create directory"
      );
  }

  /** Delete a directory in the sandbox. */
  public async delete_directory(sandbox_path: string): Promise<void> {
    const resp = await beamClient.request({
      method: "DELETE",
      url: `api/v1/gateway/pods/${
        this.sandbox_instance.containerId
      }/directories/${encodeURIComponent(sandbox_path)}`,
    });
    const data = resp.data as { ok: boolean; errorMsg?: string };
    if (!data.ok)
      throw new SandboxFileSystemError(
        data.errorMsg || "Failed to delete directory"
      );
  }

  /** Delete a file in the sandbox. */
  public async delete_file(sandbox_path: string): Promise<void> {
    const resp = await beamClient.request({
      method: "DELETE",
      url: `api/v1/gateway/pods/${
        this.sandbox_instance.containerId
      }/files/${encodeURIComponent(sandbox_path)}`,
    });
    const data = resp.data as { ok: boolean; errorMsg?: string };
    if (!data.ok)
      throw new SandboxFileSystemError(
        data.errorMsg || "Failed to delete file"
      );
  }

  /** Replace a string in all files in a directory. */
  public async replace_in_files(
    sandbox_path: string,
    old_string: string,
    new_string: string
  ): Promise<void> {
    const resp = await beamClient.request({
      method: "POST",
      url: `api/v1/gateway/pods/${this.sandbox_instance.containerId}/files/replace`,
      data: {
        containerPath: sandbox_path,
        pattern: old_string,
        newString: new_string,
      },
    });
    const data = resp.data as { ok: boolean; errorMsg?: string };
    if (!data.ok)
      throw new SandboxFileSystemError(
        data.errorMsg || "Failed to replace in files"
      );
  }

  /** Find files matching a pattern in the sandbox. */
  public async find_in_files(
    sandbox_path: string,
    pattern: string
  ): Promise<SandboxFileSearchResult[]> {
    const resp = await beamClient.request({
      method: "POST",
      url: `api/v1/gateway/pods/${this.sandbox_instance.containerId}/files/find`,
      data: { containerPath: sandbox_path, pattern },
    });
    const data = resp.data as {
      ok: boolean;
      errorMsg?: string;
      results?: any[];
    };
    if (!data.ok || !data.results)
      throw new SandboxFileSystemError(
        data.errorMsg || "Failed to find in files"
      );

    const results: SandboxFileSearchResult[] = [];
    for (const result of data.results) {
      const matches: SandboxFileSearchMatch[] = [];
      for (const match of result.matches || []) {
        matches.push(
          new SandboxFileSearchMatch(
            new SandboxFileSearchRange(
              new SandboxFilePosition(
                match.range.start.line,
                match.range.start.column
              ),
              new SandboxFilePosition(
                match.range.end.line,
                match.range.end.column
              )
            ),
            match.content
          )
        );
      }
      results.push(new SandboxFileSearchResult(result.path, matches));
    }

    return results;
  }
}
