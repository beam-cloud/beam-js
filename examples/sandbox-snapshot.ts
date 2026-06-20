import { beamOpts, Image, Sandbox } from "../lib";

beamOpts.token = process.env.BEAM_TOKEN || "";
beamOpts.gatewayUrl = process.env.BEAM_GATEWAY_URL || "https://app.beam.cloud";

async function main() {
  const sandbox = new Sandbox({
    name: "js-sandbox-snapshot",
    image: Image.fromRegistry("python:3.11-slim"),
    cpu: 1,
    memory: "512Mi",
    keepWarmSeconds: 300,
  });

  const instance = await sandbox.create();
  let restored;
  try {
    await instance.exec([
      "python3",
      "-u",
      "-c",
      "from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler; ThreadingHTTPServer(('0.0.0.0', 8899), SimpleHTTPRequestHandler).serve_forever()",
    ]);

    const checkpointId = await instance.snapshot();
    restored = await Sandbox.createFromSnapshot(checkpointId);
    const url = await restored.exposePort(8899);
    console.log(url);
  } finally {
    if (restored) {
      await restored.terminate();
    }
    await instance.terminate();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
