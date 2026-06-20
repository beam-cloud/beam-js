import { beamOpts, Image, Sandbox } from "../lib";

beamOpts.token = process.env.BEAM_TOKEN || "";
beamOpts.gatewayUrl = process.env.BEAM_GATEWAY_URL || "https://app.beam.cloud";

async function main() {
  const image = new Image({ pythonVersion: "python3.11" }).withDocker();
  const sandbox = new Sandbox({
    name: "js-sandbox-docker",
    image,
    cpu: 2,
    memory: "2Gi",
    keepWarmSeconds: 300,
    dockerEnabled: true,
  });

  const instance = await sandbox.create();
  try {
    const version = await instance.docker.version();
    await version.wait();
    console.log(await version.stdout.read());

    const hello = await instance.docker.run("hello-world", ["--rm"]);
    await hello.wait();
    console.log(await hello.stdout.read());
  } finally {
    await instance.terminate();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
