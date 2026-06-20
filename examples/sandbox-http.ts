import { beamOpts, Image, Sandbox } from "../lib";

beamOpts.token = process.env.BEAM_TOKEN || "";
beamOpts.gatewayUrl = process.env.BEAM_GATEWAY_URL || "https://app.beam.cloud";

async function main() {
  const sandbox = new Sandbox({
    name: "js-sandbox-http",
    image: Image.fromRegistry("python:3.11-slim"),
    cpu: 1,
    memory: "512Mi",
    keepWarmSeconds: 300,
  });

  const instance = await sandbox.create();
  try {
    await instance.fs.writeText("/workspace/index.html", "hello from a sandbox");
    await instance.exec(
      [
        "python3",
        "-u",
        "-m",
        "http.server",
        "8765",
        "--bind",
        "0.0.0.0",
      ],
      { cwd: "/workspace" },
    );

    const url = await instance.exposePort(8765);
    console.log(url);
    const response = await fetch(url);
    console.log(await response.text());
  } catch (error) {
    throw error;
  } finally {
    await instance.terminate();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
