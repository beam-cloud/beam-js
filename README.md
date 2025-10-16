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
npm install @beamcloud/beam-js
```

or with yarn:

```bash
yarn add @beamcloud/beam-js
```

## Quickstart

Run a simple Node.js server in a sandbox.

```typescript
import { beamOpts, Image, Sandbox } from "@beamcloud/beam-js";

beamOpts.token = process.env.BEAM_TOKEN!;
beamOpts.workspaceId = process.env.BEAM_WORKSPACE_ID!;

async function main() {
  const image = new Image({
    baseImage: "node:20",
    commands: [
      "apt update",
      "apt install -y nodejs npm",
      "git clone https://github.com/beam-cloud/quickstart-node.git /app",
    ],
  });

  const sandbox = new Sandbox({
    name: "quickstart",
    image: image,
    cpu: 2,
    memory: 1024,
    keepWarmSeconds: 300,
  });

  const instance = await sandbox.create();

  const process4 = await instance.exec("sh", "-c", "cd /app && node server.js");

  const url = await instance.exposePort(3000);
  console.log(`Server is running at ${url}`);
}

main();
```

## Support

- [Documentation](https://docs.beam.cloud/v2/reference/ts-sdk)
- [Slack Community](https://join.slack.com/t/beam-cloud/shared_invite/zt-39hbkt8ty-CTVv4NsgLoYArjWaVkwcFw)
- [GitHub Issues](https://github.com/beam-cloud/beam-js/issues)
- [Twitter](https://twitter.com/beam_cloud)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
