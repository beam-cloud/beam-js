# Beam TypeScript/JavaScript SDK - Beta

The official TypeScript/JavaScript SDK for [Beam Cloud](https://beam.cloud) - a platform for deploying and running containerized workloads at scale.

<div align="center">

<p align="center">
  <a href="https://docs.beam.cloud/v2/reference/ts-sdk">
    <img alt="Documentation" src="https://img.shields.io/badge/docs-quickstart-purple">
  </a>
  <a href="https://join.slack.com/t/beam-cloud/shared_invite/zt-39hbkt8ty-CTVv4NsgLoYArjWaVkwcFw">
    <img alt="Join Slack" src="https://img.shields.io/badge/Beam-Join%20Slack-orange?logo=slack">
  </a>
  <a href="https://twitter.com/beam_cloud">
    <img alt="Twitter" src="https://img.shields.io/twitter/follow/beam_cloud.svg?style=social&logo=twitter">
  </a>
  <a href="https://www.npmjs.com/package/@beamcloud/beam-js">
    <img alt="npm version" src="https://img.shields.io/npm/v/@beamcloud/beam-js.svg">
  </a>
  <a href="https://github.com/beam-cloud/beam-js/blob/main/LICENSE">
    <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg">
  </a>
</p>

</div>

## Installation

```bash
npm install @beamcloud/beam-js@rc
```

or with yarn:

```bash
yarn add @beamcloud/beam-js@rc
```

## Quickstart

Create a sandbox, run code, write a file, and expose a small HTTP server.

```typescript
import { beamOpts, Image, Sandbox } from "@beamcloud/beam-js";

beamOpts.token = process.env.BEAM_TOKEN!;

async function main() {
  const sandbox = new Sandbox({
    name: "quickstart",
    image: Image.fromRegistry("python:3.11-slim"),
    cpu: 1,
    memory: "512Mi",
    keepWarmSeconds: 300,
  });

  const instance = await sandbox.create();
  try {
    const result = await instance.runCode("print('hello from Beam JS')");
    console.log(result);

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
    console.log(`Server is running at ${url}`);
  } finally {
    await instance.terminate();
  }
}

main();
```

## Sandbox examples

Run these from a checkout of this repository:

```bash
BEAM_TOKEN=... npx tsx examples/sandbox-basic.ts
BEAM_TOKEN=... npx tsx examples/sandbox-http.ts
BEAM_TOKEN=... npx tsx examples/sandbox-snapshot.ts
```

Docker-in-Docker support requires an image with Docker installed and
`dockerEnabled: true`:

```bash
BEAM_TOKEN=... npx tsx examples/sandbox-docker.ts
```

The SDK defaults to Beam production (`https://app.beam.cloud`). Set
`BEAM_GATEWAY_URL` only when testing a development gateway.

## Production sandbox e2e tests

The normal test suite does not create cloud resources. Run the sandbox e2e tests
explicitly:

```bash
BEAM_TOKEN=... npm run test:e2e:sandbox
```

Docker coverage is opt-in because it builds a Docker-enabled image:

```bash
BEAM_TOKEN=... BEAM_SANDBOX_E2E_DOCKER=1 npm run test:e2e:sandbox
```

## Support

- [Documentation](https://docs.beam.cloud/v2/reference/ts-sdk)
- [Slack Community](https://join.slack.com/t/beam-cloud/shared_invite/zt-39hbkt8ty-CTVv4NsgLoYArjWaVkwcFw)
- [GitHub Issues](https://github.com/beam-cloud/beam-js/issues)
- [Twitter](https://twitter.com/beam_cloud)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
