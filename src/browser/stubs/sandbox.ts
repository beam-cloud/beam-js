export class SandboxConnectionError extends Error {}
export class SandboxFileSystemError extends Error {}
export class SandboxProcessError extends Error {}

export class Sandbox {
  public syncLocalDir: boolean = false;

  constructor(_: any, syncLocalDir: boolean = false) {
    this.syncLocalDir = syncLocalDir;
  }

  async connect(): Promise<any> {
    throw new Error(
      "Sandbox.connect is Node-only and unavailable in the browser build."
    );
  }

  async create(): Promise<any> {
    throw new Error(
      "Sandbox.create is Node-only and unavailable in the browser build."
    );
  }

  async createFromSnapshot(): Promise<any> {
    throw new Error(
      "Sandbox.createFromSnapshot is Node-only and unavailable in the browser build."
    );
  }
}

export class SandboxInstance {}

export class SandboxFileSystem {}
