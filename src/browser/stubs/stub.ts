export class StubBuilder {
  constructor(_: any) {}
  async prepareRuntime(): Promise<boolean> {
    throw new Error(
      "StubBuilder.prepareRuntime is Node-only and unavailable in the browser build."
    );
  }
  async deployStub(): Promise<any> {
    throw new Error(
      "StubBuilder.deployStub is Node-only and unavailable in the browser build."
    );
  }
}

// Re-export types as no-ops, consumers should import from shared types
export type {};
