import { randomUUID } from "crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { beamOpts, Image, Sandbox } from "../lib";

const runE2E = process.env.BEAM_SANDBOX_E2E === "1" ? describe : describe.skip;
const runDockerE2E =
  process.env.BEAM_SANDBOX_E2E_DOCKER === "1" ? test : test.skip;

function configureBeam() {
  beamOpts.token = process.env.BEAM_TOKEN || "";
  beamOpts.workspaceId = process.env.BEAM_WORKSPACE_ID || "";
  beamOpts.gatewayUrl = process.env.BEAM_GATEWAY_URL || "https://app.beam.cloud";
  beamOpts.timeout = 600_000;

  if (!beamOpts.token) {
    throw new Error("BEAM_TOKEN is required for sandbox e2e tests");
  }
}

async function expectEventually(
  fn: () => Promise<void>,
  timeoutMs: number = 60_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await fn();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw lastError;
}

runE2E("Sandbox production e2e", () => {
  beforeAll(configureBeam);

  jest.setTimeout(900_000);

  test("runs code, streams logs, manages files, exposes ports, reconnects, and terminates", async () => {
    const runId = randomUUID().slice(0, 8);
    const sandbox = new Sandbox({
      name: `js-e2e-core-${runId}`,
      app: "js-sdk-sandbox-e2e",
      image: Image.fromRegistry("python:3.11-slim"),
      cpu: 1,
      memory: "512Mi",
      keepWarmSeconds: 300,
      env: { BEAM_JS_E2E_RUN: runId },
    });

    const instance = await sandbox.create();
    let completed = false;
    try {
      await expect(instance.poll()).resolves.toBeNull();

      const result = await instance.runCode(
        "import os; print('run=' + os.environ['BEAM_JS_E2E_RUN'])",
      );
      expect("result" in result ? result.exitCode : -1).toBe(0);
      expect("result" in result ? result.stdout : "").toContain(`run=${runId}`);

      await instance.fs.createDirectory("/workspace/js-e2e");
      await instance.fs.writeText("/workspace/js-e2e/message.txt", "hello js sdk");
      await expect(
        instance.fs.readText("/workspace/js-e2e/message.txt"),
      ).resolves.toBe("hello js sdk");

      const tmp = mkdtempSync(join(tmpdir(), "beam-js-e2e-"));
      try {
        const uploadPath = join(tmp, "upload.txt");
        const downloadPath = join(tmp, "download.txt");
        writeFileSync(uploadPath, "uploaded from node");
        await instance.fs.uploadFile(uploadPath, "/workspace/js-e2e/upload.txt");
        await instance.fs.downloadFile("/workspace/js-e2e/upload.txt", downloadPath);
        expect(readFileSync(downloadPath, "utf8")).toBe("uploaded from node");
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }

      const stat = await instance.fs.statFile("/workspace/js-e2e/message.txt");
      expect(stat.isDir).toBe(false);
      expect(stat.size).toBeGreaterThan(0);

      const files = await instance.fs.listFiles("/workspace/js-e2e");
      expect(files.map((file) => file.name)).toContain("message.txt");

      await instance.fs.replaceInFiles("/workspace/js-e2e", "hello", "goodbye");
      const matches = await instance.fs.findInFiles("/workspace/js-e2e", "goodbye");
      expect(matches.length).toBeGreaterThan(0);
      await expect(
        instance.fs.readText("/workspace/js-e2e/message.txt"),
      ).resolves.toContain("goodbye");

      const logProcess = await instance.exec([
        "python3",
        "-u",
        "-c",
        [
          "import sys,time",
          "print('stdout-one', flush=True)",
          "print('stderr-one', file=sys.stderr, flush=True)",
          "time.sleep(0.5)",
          "print('stdout-two', flush=True)",
          "print('stderr-two', file=sys.stderr, flush=True)",
        ].join("; "),
      ]);

      const streamed: string[] = [];
      for await (const line of logProcess.logs) {
        streamed.push(line);
      }
      await expect(logProcess.wait()).resolves.toBe(0);
      expect(streamed.join("")).toContain("stdout-one");
      expect(streamed.join("")).toContain("stderr-two");

      const readProcess = await instance.exec([
        "python3",
        "-u",
        "-c",
        [
          "import sys",
          "print('stdout-read', flush=True)",
          "print('stderr-read', file=sys.stderr, flush=True)",
        ].join("; "),
      ]);
      await expect(readProcess.wait()).resolves.toBe(0);
      await expect(readProcess.stdout.read()).resolves.toContain("stdout-read");
      await expect(readProcess.stderr.read()).resolves.toContain("stderr-read");

      const shellProcess = await instance.exec("printf shell-ok");
      await expect(shellProcess.wait()).resolves.toBe(0);
      await expect(shellProcess.stdout.read()).resolves.toBe("shell-ok");

      const sleepProcess = await instance.exec(["sleep", "120"]);
      const listed = await instance.listProcesses();
      expect(listed.some((process) => process.pid === sleepProcess.pid)).toBe(true);

      const reconnected = await Sandbox.connect(instance.sandboxId);
      const reconnectedProcesses = await reconnected.listProcesses();
      expect(
        reconnectedProcesses.some((process) => process.pid === sleepProcess.pid),
      ).toBe(true);

      await sleepProcess.kill();
      await expect(sleepProcess.wait()).resolves.not.toBe(0);

      const server = await instance.exec([
        "python3",
        "-u",
        "-m",
        "http.server",
        "8765",
        "--bind",
        "0.0.0.0",
      ]);
      const url = await instance.exposePort(8765);
      const urls = await instance.listUrls();
      expect(urls[8765]).toBe(url);

      await expectEventually(async () => {
        const response = await fetch(url);
        expect(response.ok).toBe(true);
        expect(await response.text()).toContain("Directory listing");
      });

      await server.kill();
      await instance.fs.remove("/workspace/js-e2e/message.txt");
      await instance.fs.remove("/workspace/js-e2e/upload.txt");
      await instance.fs.remove("/workspace/js-e2e");
      await instance.updateTtl(120);
      await expect(instance.updateNetworkPermissions(false)).resolves.toBeUndefined();
      completed = true;
    } finally {
      const terminated = await instance.terminate();
      if (completed) {
        expect(terminated).toBe(true);
      }
    }
  });

  test("restores a memory snapshot and serves restored HTTP state", async () => {
    const runId = randomUUID().slice(0, 8);
    const sandbox = new Sandbox({
      name: `js-e2e-snapshot-${runId}`,
      app: "js-sdk-sandbox-e2e",
      image: Image.fromRegistry("python:3.11-slim"),
      cpu: 1,
      memory: "512Mi",
      keepWarmSeconds: 300,
    });

    const instance = await sandbox.create();
    let restored: Awaited<ReturnType<typeof Sandbox.createFromSnapshot>> | undefined;
    try {
      const code = [
        "from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer",
        `STATE = {'value': '${runId}'}`,
        "class Handler(BaseHTTPRequestHandler):",
        "    def do_GET(self):",
        "        self.send_response(200)",
        "        self.end_headers()",
        "        self.wfile.write(('state=' + STATE['value']).encode())",
        "    def log_message(self, *args): pass",
        "ThreadingHTTPServer(('0.0.0.0', 8899), Handler).serve_forever()",
      ].join("\n");

      await instance.exec(["python3", "-u", "-c", code]);
      const url = await instance.exposePort(8899);
      await expectEventually(async () => {
        const response = await fetch(url);
        expect(await response.text()).toBe(`state=${runId}`);
      });

      const checkpointId = await instance.snapshot();
      restored = await Sandbox.createFromSnapshot(checkpointId);
      const restoredUrl = await restored.exposePort(8899);
      await expectEventually(async () => {
        const response = await fetch(restoredUrl);
        expect(await response.text()).toBe(`state=${runId}`);
      }, 120_000);
    } finally {
      if (restored) {
        await restored.terminate();
      }
      await instance.terminate();
    }
  });

  runDockerE2E("runs Docker commands in a Docker-enabled sandbox", async () => {
    const runId = randomUUID().slice(0, 8);
    const image = new Image({ pythonVersion: "python3.11" }).withDocker();
    const sandbox = new Sandbox({
      name: `js-e2e-docker-${runId}`,
      app: "js-sdk-sandbox-e2e",
      image,
      cpu: 2,
      memory: "2Gi",
      keepWarmSeconds: 300,
      dockerEnabled: true,
    });

    const instance = await sandbox.create();
    try {
      const version = await instance.docker.version();
      await expect(version.wait()).resolves.toBe(0);
      await expect(version.stdout.read()).resolves.toContain("Client:");

      const hello = await instance.docker.run("hello-world", ["--rm"]);
      await expect(hello.wait()).resolves.toBe(0);
      await expect(hello.stdout.read()).resolves.toContain("Hello from Docker");
    } finally {
      await instance.terminate();
    }
  });
});
