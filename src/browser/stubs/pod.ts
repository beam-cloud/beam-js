export class Pod {
  constructor(_: any) {}
  async create(): Promise<any> {
    throw new Error(
      "Pod.create is Node-only and unavailable in the browser build."
    );
  }
  async deploy(): Promise<any> {
    throw new Error(
      "Pod.deploy is Node-only and unavailable in the browser build."
    );
  }
  parseAndValidate(): { ignorePatterns: string[] } {
    throw new Error(
      "Pod.parseAndValidate is Node-only and unavailable in the browser build."
    );
  }
}

export class PodInstance {}
