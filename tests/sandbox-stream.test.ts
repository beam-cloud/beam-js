import { SandboxProcessStream } from "../lib/resources/abstraction/sandbox";

// Minimal mock of SandboxProcess — only `status()` is used by the iterator
function makeMockProcess(exitCode: number = 0) {
  return {
    status: jest.fn().mockResolvedValue([exitCode, "done"]),
  } as any;
}

describe("SandboxProcessStream async iterator", () => {
  test("yields all lines from a multi-line buffer", async () => {
    const output = "line1\nline2\nline3\n";
    let callCount = 0;

    const stream = new SandboxProcessStream(
      makeMockProcess(0),
      () => {
        // Return the full output on the first call, then empty
        if (callCount++ === 0) return output;
        return output; // same content means no new data
      }
    );

    const lines: string[] = [];
    for await (const line of stream) {
      lines.push(line);
    }

    expect(lines).toEqual(["line1\n", "line2\n", "line3\n"]);
  });

  test("yields lines correctly when output arrives in chunks", async () => {
    const chunks = ["hello\nworld", "\nfoo\n"];
    let callCount = 0;
    let accumulated = "";

    const stream = new SandboxProcessStream(
      makeMockProcess(0),
      () => {
        if (callCount < chunks.length) {
          accumulated += chunks[callCount++];
        }
        return accumulated;
      }
    );

    const lines: string[] = [];
    for await (const line of stream) {
      lines.push(line);
    }

    expect(lines).toEqual(["hello\n", "world\n", "foo\n"]);
  });

  test("yields final partial line without trailing newline", async () => {
    const output = "line1\nno-newline-at-end";
    let callCount = 0;

    const stream = new SandboxProcessStream(
      makeMockProcess(0),
      () => {
        if (callCount++ === 0) return output;
        return output;
      }
    );

    const lines: string[] = [];
    for await (const line of stream) {
      lines.push(line);
    }

    expect(lines).toEqual(["line1\n", "no-newline-at-end"]);
  });

  test("handles single line with newline", async () => {
    const output = "only-line\n";
    let callCount = 0;

    const stream = new SandboxProcessStream(
      makeMockProcess(0),
      () => {
        if (callCount++ === 0) return output;
        return output;
      }
    );

    const lines: string[] = [];
    for await (const line of stream) {
      lines.push(line);
    }

    expect(lines).toEqual(["only-line\n"]);
  });
});
