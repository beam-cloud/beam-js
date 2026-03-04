import runsManager, { Run } from "../lib/resources/run";
import { ERunStatus, RunData } from "../lib/types/run";
import { serializeNestedBaseObject } from "../lib/types/base";

jest.mock("../lib/index", () => ({
  __esModule: true,
  default: {
    request: jest.fn(),
    _parseOptsToURLParams: jest.fn(() => new URLSearchParams()),
  },
  beamOpts: {
    workspaceId: "test-workspace-id",
    token: "test-token",
    gatewayUrl: "https://test.beam.cloud",
  },
}));

import beamClient, { beamOpts } from "../lib/index";

const mockRequest = beamClient.request as jest.MockedFunction<
  typeof beamClient.request
>;

const makeRunData = (overrides: Partial<RunData> = {}): RunData => ({
  id: "run-123",
  createdAt: "2024-01-01T00:00:00",
  updatedAt: "2024-01-01T00:01:00",
  status: ERunStatus.COMPLETE,
  containerId: "container-abc",
  startedAt: "2024-01-01T00:00:01",
  endedAt: "2024-01-01T00:01:00",
  stubId: "stub-xyz",
  stubName: "my-function",
  workspaceId: "test-workspace-id",
  workspaceName: "my-workspace",
  ...overrides,
});

describe("ERunStatus", () => {
  test("has expected status values", () => {
    expect(ERunStatus.PENDING).toBe("PENDING");
    expect(ERunStatus.RUNNING).toBe("RUNNING");
    expect(ERunStatus.ERROR).toBe("ERROR");
    expect(ERunStatus.TIMEOUT).toBe("TIMEOUT");
    expect(ERunStatus.RETRY).toBe("RETRY");
    expect(ERunStatus.COMPLETE).toBe("COMPLETE");
    expect(ERunStatus.CANCELLED).toBe("CANCELLED");
    expect(ERunStatus.EXPIRED).toBe("EXPIRED");
  });
});

describe("Run", () => {
  describe("constructor", () => {
    test("sets data and manager", () => {
      const data = makeRunData();
      const run = new Run(runsManager, data);
      expect(run.data).toBe(data);
      expect(run.manager).toBe(runsManager);
    });
  });

  describe("cancel()", () => {
    test("delegates to manager.cancel with self", async () => {
      const run = new Run(runsManager, makeRunData());
      mockRequest.mockResolvedValueOnce({ data: undefined });

      await run.cancel();

      expect(mockRequest).toHaveBeenCalledWith({
        method: "DELETE",
        url: `/api/v1/run/${beamOpts.workspaceId}`,
        data: { ids: ["run-123"] },
      });
    });
  });

  describe("refresh()", () => {
    test("fetches updated data and updates this.data", async () => {
      const run = new Run(runsManager, makeRunData({ status: ERunStatus.RUNNING }));
      const updatedData = makeRunData({ status: ERunStatus.COMPLETE });

      mockRequest.mockResolvedValueOnce({ data: updatedData, status: 200 });

      const returned = await run.refresh();

      expect(returned).toBe(run);
      expect(run.data.status).toBe(ERunStatus.COMPLETE);
    });

    test("returns this after updating", async () => {
      const run = new Run(runsManager, makeRunData());
      mockRequest.mockResolvedValueOnce({ data: makeRunData(), status: 200 });

      const result = await run.refresh();

      expect(result).toBe(run);
    });
  });
});

describe("Runs", () => {
  describe("cancel()", () => {
    test("sends DELETE with array of string IDs", async () => {
      mockRequest.mockResolvedValueOnce({ data: undefined });

      await runsManager.cancel(["run-1", "run-2"]);

      expect(mockRequest).toHaveBeenCalledWith({
        method: "DELETE",
        url: `/api/v1/run/${beamOpts.workspaceId}`,
        data: { ids: ["run-1", "run-2"] },
      });
    });

    test("extracts IDs from Run instances", async () => {
      mockRequest.mockResolvedValueOnce({ data: undefined });
      const run1 = new Run(runsManager, makeRunData({ id: "run-1" }));
      const run2 = new Run(runsManager, makeRunData({ id: "run-2" }));

      await runsManager.cancel([run1, run2]);

      expect(mockRequest).toHaveBeenCalledWith({
        method: "DELETE",
        url: `/api/v1/run/${beamOpts.workspaceId}`,
        data: { ids: ["run-1", "run-2"] },
      });
    });

    test("sends DELETE with single ID", async () => {
      mockRequest.mockResolvedValueOnce({ data: undefined });

      await runsManager.cancel(["run-only"]);

      expect(mockRequest).toHaveBeenCalledWith({
        method: "DELETE",
        url: `/api/v1/run/${beamOpts.workspaceId}`,
        data: { ids: ["run-only"] },
      });
    });
  });

  describe("get()", () => {
    test("returns a Run instance with the fetched data", async () => {
      const runData = makeRunData({ id: "run-456" });
      mockRequest.mockResolvedValueOnce({ data: runData, status: 200 });

      const run = await runsManager.get({ id: "run-456" });

      expect(run).toBeInstanceOf(Run);
      expect(run.data.id).toBe("run-456");
      expect(run.data.status).toBe(ERunStatus.COMPLETE);
    });

    test("calls the correct API URL", async () => {
      mockRequest.mockResolvedValueOnce({ data: makeRunData(), status: 200 });

      await runsManager.get({ id: "run-123" });

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `/api/v1/run/${beamOpts.workspaceId}/run-123`,
        })
      );
    });

    test("throws when request fails", async () => {
      const error = Object.assign(new Error("Server Error"), {
        isAxiosError: true,
        response: { status: 500, statusText: "Internal Server Error" },
      });
      mockRequest.mockRejectedValueOnce(error);

      await expect(runsManager.get({ id: "run-bad" })).rejects.toThrow();
    });
  });

  describe("list()", () => {
    test("returns an array of Run instances", async () => {
      const data1 = makeRunData({ id: "run-1" });
      const data2 = makeRunData({ id: "run-2", status: ERunStatus.RUNNING });
      mockRequest.mockResolvedValueOnce({
        data: { data: [data1, data2] },
        status: 200,
      });

      const runs = await runsManager.list();

      expect(runs).toHaveLength(2);
      expect(runs[0]).toBeInstanceOf(Run);
      expect(runs[1]).toBeInstanceOf(Run);
      expect(runs[0].data.id).toBe("run-1");
      expect(runs[1].data.status).toBe(ERunStatus.RUNNING);
    });

    test("returns empty array when response has no data", async () => {
      mockRequest.mockResolvedValueOnce({
        data: { data: null },
        status: 200,
      });

      const runs = await runsManager.list();

      expect(runs).toEqual([]);
    });

    test("passes filter options to _parseOptsToURLParams", async () => {
      mockRequest.mockResolvedValueOnce({ data: { data: [] }, status: 200 });

      await runsManager.list({ stubId: "stub-xyz", status: ERunStatus.RUNNING });

      expect(beamClient._parseOptsToURLParams).toHaveBeenCalledWith({
        stubId: "stub-xyz",
        status: ERunStatus.RUNNING,
      });
    });
  });
});

describe("RunData serialization", () => {
  test("serializeNestedBaseObject maps external_id to id", () => {
    const raw = {
      external_id: "run-999",
      status: ERunStatus.COMPLETE,
      created_at: "2024-01-01T00:00:00",
      updated_at: "2024-01-01T00:01:00",
    };

    const serialized = serializeNestedBaseObject(raw);

    expect(serialized.id).toBe("run-999");
  });

  test("serializeNestedBaseObject converts ISO date strings to Date objects", () => {
    const raw = {
      external_id: "run-123",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:01:00Z",
    };

    const serialized = serializeNestedBaseObject(raw);

    expect(serialized.created_at).toBeInstanceOf(Date);
    expect(serialized.updated_at).toBeInstanceOf(Date);
  });

  test("serializeNestedBaseObject preserves non-date string fields", () => {
    const raw = {
      external_id: "run-123",
      status: ERunStatus.RUNNING,
      stub_id: "stub-xyz",
      stub_name: "my-function",
    };

    const serialized = serializeNestedBaseObject(raw);

    expect(serialized.status).toBe(ERunStatus.RUNNING);
    expect(serialized.stub_id).toBe("stub-xyz");
    expect(serialized.stub_name).toBe("my-function");
  });
});
