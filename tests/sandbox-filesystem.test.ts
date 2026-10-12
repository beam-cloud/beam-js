import beamClient from "../lib";
import { Sandbox, SandboxInstance } from "../lib/resources/abstraction/sandbox";

describe("Sandbox filesystem convenience methods", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function instance() {
    return new SandboxInstance(
      {
        containerId: "sandbox-123",
        stubId: "stub-123",
        url: "",
        ok: true,
        errorMsg: "",
      },
      new Sandbox({ name: "filesystem-sandbox" }),
    );
  }

  test("writes and reads text and bytes", async () => {
    const requestMock = jest
      .spyOn(beamClient, "request")
      .mockResolvedValueOnce({ data: { ok: true, errorMsg: "" } })
      .mockResolvedValueOnce({ data: { ok: true, errorMsg: "" } })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          errorMsg: "",
          data: Buffer.from("hello").toString("base64"),
        },
      });

    const fs = instance().fs;
    await fs.writeText("/workspace/message.txt", "hello");
    await fs.writeBytes("/workspace/blob.bin", Buffer.from([0, 1]));
    await expect(fs.readText("/workspace/message.txt")).resolves.toBe("hello");

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          containerPath: "/workspace/message.txt",
          data: Buffer.from("hello").toString("base64"),
        }),
      }),
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          containerPath: "/workspace/blob.bin",
          data: Buffer.from([0, 1]).toString("base64"),
        }),
      }),
    );
  });

  test("removes files and directories", async () => {
    const requestMock = jest
      .spyOn(beamClient, "request")
      .mockResolvedValueOnce({
        data: {
          ok: true,
          errorMsg: "",
          fileInfo: {
            name: "message.txt",
            isDir: false,
            size: 1,
            mode: 0o644,
            modTime: 0,
            owner: "",
            group: "",
            permissions: 0o644,
          },
        },
      })
      .mockResolvedValueOnce({ data: { ok: true, errorMsg: "" } })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          errorMsg: "",
          fileInfo: {
            name: "data",
            isDir: true,
            size: 0,
            mode: 0o755,
            modTime: 0,
            owner: "",
            group: "",
            permissions: 0o755,
          },
        },
      })
      .mockResolvedValueOnce({ data: { ok: true, errorMsg: "" } });

    const fs = instance().fs;
    await fs.remove("/workspace/message.txt");
    await fs.remove("/workspace/data");

    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        method: "DELETE",
        url: "api/v1/gateway/pods/sandbox-123/files/%2Fworkspace%2Fmessage.txt",
      }),
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        method: "DELETE",
        url: "api/v1/gateway/pods/sandbox-123/directories/%2Fworkspace%2Fdata",
      }),
    );
  });
});
