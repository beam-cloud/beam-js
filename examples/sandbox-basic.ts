import { beamOpts, Image, Sandbox } from "../lib";

beamOpts.token = process.env.BEAM_TOKEN || "";
beamOpts.gatewayUrl = process.env.BEAM_GATEWAY_URL || "https://app.beam.cloud";

async function main() {
  const sandbox = new Sandbox({
    name: "js-sandbox-basic",
    image: Image.fromRegistry("python:3.11-slim"),
    cpu: 1,
    memory: "512Mi",
    keepWarmSeconds: 300,
  });

  const instance = await sandbox.create();
  try {
    const result = await instance.runCode("print('hello from Beam JS')");
    console.log(result);

    await instance.fs.writeText("/workspace/message.txt", "hello filesystem");
    console.log(await instance.fs.readText("/workspace/message.txt"));

    const process = await instance.exec("printf streamed-log");
    for await (const line of process.logs) {
      console.log(line);
    }
  } finally {
    await instance.terminate();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
