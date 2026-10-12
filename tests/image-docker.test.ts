import { Image } from "../lib/resources/abstraction/image";
import { SandboxDockerManager } from "../lib/resources/abstraction/sandbox";

describe("Image.withDocker", () => {
  test("adds Docker installation build steps", () => {
    const image = new Image({ pythonVersion: "python3.11" }).withDocker();

    expect(image.config.buildSteps.length).toBeGreaterThan(0);
    expect(image.config.buildSteps.map((step) => step.type)).toEqual(
      image.config.buildSteps.map(() => "shell"),
    );
    expect(image.config.buildSteps.map((step) => step.command).join("\n")).toContain(
      "docker-ce",
    );
  });
});

describe("SandboxDockerManager", () => {
  test("runs inner containers with host network and pid namespace", async () => {
    const exec = jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue(0) });
    const manager = new SandboxDockerManager({ exec } as any);
    jest.spyOn(manager, "ensureReady").mockResolvedValue(undefined);

    await manager.run("hello-world", ["--rm"]);

    expect(exec).toHaveBeenCalledWith([
      "docker",
      "run",
      "--network",
      "host",
      "--pid",
      "host",
      "--rm",
      "hello-world",
    ], undefined);
  });
});
