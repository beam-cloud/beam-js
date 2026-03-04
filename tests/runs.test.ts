import Runs, { Run } from "../lib/resources/run";
import { ETaskStatus } from "../lib/types/task";
import { EStubType } from "../lib/types/stub";

// Mock the beamClient and beamOpts used by the resource
jest.mock("../lib/index", () => ({
  __esModule: true,
  default: {
    request: jest.fn(),
    _parseOptsToURLParams: jest.fn((opts) => new URLSearchParams(opts)),
  },
  beamOpts: {
    token: "test-token",
    workspaceId: "test-workspace",
    gatewayUrl: "https://app.beam.cloud",
    timeout: 30000,
  },
}));

import beamClient, { beamOpts } from "../lib/index";

const mockBeamClient = beamClient as jest.Mocked<typeof beamClient>;

function makeRunData(overrides = {}) {
  return {
    id: "run-abc123",
    status: ETaskStatus.RUNNING,
    containerId: "container-xyz",
    startedAt: "2024-01-01T00:00:00Z",
    endedAt: "",
    stubId: "stub-123",
    stubName: "my-pod",
    workspaceId: "test-workspace",
    workspaceName: "my-workspace",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("Run", () => {
  describe("constructor", () => {
    test("stores data and manager references", () => {
      const data = makeRunData();
      const run = new Run(Runs, data);

      expect(run.data).toBe(data);
      expect(run.manager).toBe(Runs);
    });

    test("exposes run fields via data", () => {
      const data = makeRunData({ status: ETaskStatus.COMPLETE, containerId: "c-99" });
      const run = new Run(Runs, data);

      expect(run.data.status).toBe(ETaskStatus.COMPLETE);
      expect(run.data.containerId).toBe("c-99");
      expect(run.data.id).toBe("run-abc123");
    });
  });

  describe("cancel", () => {
    test("delegates to manager.cancel with self", async () => {
      const data = makeRunData();
      const run = new Run(Runs, data);
      const cancelSpy = jest.spyOn(Runs, "cancel").mockResolvedValue(undefined);

      await run.cancel();

      expect(cancelSpy).toHaveBeenCalledWith([run]);
      cancelSpy.mockRestore();
    });
  });

  describe("refresh", () => {
    test("calls manager.get with run id and updates data", async () => {
      const originalData = makeRunData({ status: ETaskStatus.RUNNING });
      const updatedData = makeRunData({ status: ETaskStatus.COMPLETE });
      const run = new Run(Runs, originalData);

      const getSpy = jest.spyOn(Runs, "get").mockResolvedValue(new Run(Runs, updatedData));

      const result = await run.refresh();

      expect(getSpy).toHaveBeenCalledWith({ id: "run-abc123" });
      expect(run.data.status).toBe(ETaskStatus.COMPLETE);
      expect(result).toBe(run);

      getSpy.mockRestore();
    });
  });
});

describe("Runs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("_constructResource", () => {
    test("creates a Run instance from data", () => {
      const data = makeRunData();
      const run = (Runs as any)._constructResource(data);

      expect(run).toBeInstanceOf(Run);
      expect(run.data).toBe(data);
    });
  });

  describe("object", () => {
    test("uses task as the API object name", () => {
      expect((Runs as any).object).toBe("task");
    });
  });

  describe("list", () => {
    test("passes pod/run stub type filter to the API", async () => {
      (mockBeamClient.request as jest.Mock).mockResolvedValue({
        status: 200,
        data: { data: [makeRunData()] },
      });
      (mockBeamClient._parseOptsToURLParams as jest.Mock).mockReturnValue(
        new URLSearchParams({ stub_type: EStubType.PodRun })
      );

      await Runs.list();

      expect(mockBeamClient._parseOptsToURLParams).toHaveBeenCalledWith(
        expect.objectContaining({ stubType: EStubType.PodRun })
      );
    });

    test("merges caller opts with pod/run stub type", async () => {
      (mockBeamClient.request as jest.Mock).mockResolvedValue({
        status: 200,
        data: { data: [] },
      });
      (mockBeamClient._parseOptsToURLParams as jest.Mock).mockReturnValue(
        new URLSearchParams()
      );

      await Runs.list({ limit: 10 });

      expect(mockBeamClient._parseOptsToURLParams).toHaveBeenCalledWith(
        expect.objectContaining({ stubType: EStubType.PodRun, limit: 10 })
      );
    });

    test("returns Run instances", async () => {
      const runData = makeRunData();
      (mockBeamClient.request as jest.Mock).mockResolvedValue({
        status: 200,
        data: { data: [runData] },
      });
      (mockBeamClient._parseOptsToURLParams as jest.Mock).mockReturnValue(
        new URLSearchParams()
      );

      const runs = await Runs.list();

      expect(runs).toHaveLength(1);
      expect(runs[0]).toBeInstanceOf(Run);
      expect(runs[0].data.id).toBe("run-abc123");
    });

    test("returns empty array when API returns no data", async () => {
      (mockBeamClient.request as jest.Mock).mockResolvedValue({
        status: 200,
        data: {},
      });
      (mockBeamClient._parseOptsToURLParams as jest.Mock).mockReturnValue(
        new URLSearchParams()
      );

      const runs = await Runs.list();

      expect(runs).toEqual([]);
    });
  });

  describe("cancel", () => {
    test("sends DELETE request with run ids from Run instances", async () => {
      (mockBeamClient.request as jest.Mock).mockResolvedValue(undefined);

      const run1 = new Run(Runs, makeRunData({ id: "run-1" }));
      const run2 = new Run(Runs, makeRunData({ id: "run-2" }));

      await Runs.cancel([run1, run2]);

      expect(mockBeamClient.request).toHaveBeenCalledWith({
        method: "DELETE",
        url: `/api/v1/task/${beamOpts.workspaceId}`,
        data: { ids: ["run-1", "run-2"] },
      });
    });

    test("sends DELETE request with raw id strings", async () => {
      (mockBeamClient.request as jest.Mock).mockResolvedValue(undefined);

      await Runs.cancel(["run-abc", "run-def"]);

      expect(mockBeamClient.request).toHaveBeenCalledWith({
        method: "DELETE",
        url: `/api/v1/task/${beamOpts.workspaceId}`,
        data: { ids: ["run-abc", "run-def"] },
      });
    });

    test("handles mixed Run instances and id strings", async () => {
      (mockBeamClient.request as jest.Mock).mockResolvedValue(undefined);

      const run = new Run(Runs, makeRunData({ id: "run-obj" }));

      await Runs.cancel([run, "run-str"]);

      expect(mockBeamClient.request).toHaveBeenCalledWith({
        method: "DELETE",
        url: `/api/v1/task/${beamOpts.workspaceId}`,
        data: { ids: ["run-obj", "run-str"] },
      });
    });

    test("handles empty array", async () => {
      (mockBeamClient.request as jest.Mock).mockResolvedValue(undefined);

      await Runs.cancel([]);

      expect(mockBeamClient.request).toHaveBeenCalledWith({
        method: "DELETE",
        url: `/api/v1/task/${beamOpts.workspaceId}`,
        data: { ids: [] },
      });
    });
  });
});
