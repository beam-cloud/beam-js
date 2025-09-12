import APIResource, { ResourceObject } from "../base";
import { Image } from "./image";
import {
  PodData,
  CreatePodRequest,
  CreatePodResponse,
  StopPodRequest,
  StopPodResponse,
  PodInstanceData,
} from "../../types/pod";
import { GpuType } from "../../types/image";
import { Stub, StubConfig } from "./stub";
import {
  EStubType,
  DeployStubRequest,
  DeployStubResponse,
} from "../../types/stub";
import { camelCaseToSnakeCaseKeys } from "../../util";
import BeamClient from "../..";

// TODO: Temp fix until common.py is implemented
let USER_CODE_DIR = "/mnt/code";

// export class Pods extends APIResource<Pod, PodData> {
//   public object: string = "pod";

//   public async createPod(
//     request: CreatePodRequest
//   ): Promise<CreatePodResponse> {
//     const response = await this.request<{ data: CreatePodResponse }>({
//       method: "POST",
//       url: `/api/v1/gateway/pods`,
//       data: request,
//     });
//     return response.data;
//   }

//   public async stopPod(request: StopPodRequest): Promise<StopPodResponse> {
//     const { containerId } = request;
//     const response = await this.request<{ data: StopPodResponse }>({
//       method: "POST",
//       url: `api/v1/gateway/pods/${containerId}/kill`,
//       data: {},
//     });
//     return response.data;
//   }

//   public async deployStub(
//     request: DeployStubRequest
//   ): Promise<DeployStubResponse> {
//     const response = await this.request<{ data: DeployStubResponse }>({
//       method: "POST",
//       url: "/api/v1/gateway/stubs/deploy",
//       data: camelCaseToSnakeCaseKeys(request),
//     });
//     return response.data;
//   }
// }

export class Pod {
  public data: PodData;
  public stub: Stub;

  constructor(client: BeamClient, config: StubConfig) {
    this.stub = new Stub(client, config);
  }

  public async createPod(
    request: CreatePodRequest
  ): Promise<CreatePodResponse> {
    const response = await this.stub.client.request({
      method: "POST",
      url: `/api/v1/gateway/pods`,
      data: request,
    });

    return response.data;
  }

  public async create(entrypoint?: string[]): Promise<PodInstance> {
    if (entrypoint) {
      this.stub.config.entrypoint = entrypoint;
    }

    let is_custom_image =
      this.stub.config.image?.config.baseImage ||
      this.stub.config.image?.config.dockerfile;

    if (!this.stub.config.entrypoint.length && !is_custom_image) {
      throw new Error(
        "You must specify an entrypoint or provide a custom image."
      );
    }

    let ignore_patterns: string[] = [];
    if (is_custom_image) {
      ignore_patterns = ["**"];
    }

    if (!is_custom_image && this.stub.config.entrypoint) {
      this.stub.config.entrypoint = [
        "sh",
        "-c",
        `cd ${USER_CODE_DIR} && ${this.stub.config.entrypoint.join(" ")}`,
      ];
    }

    const prepared = await this.stub.prepareRuntime(
      undefined,
      EStubType.PodRun,
      true,
      ignore_patterns
    );
    if (!prepared) {
      return new PodInstance(
        {
          containerId: "",
          url: "",
          ok: false,
          errorMsg: "Failed to prepare runtime",
        },
        this.stub.client,
        this
      );
    }

    if (!this.stub.stubId) {
      throw new Error("Stub not created");
    }

    const createResp = await this.createPod({
      stubId: this.stub.stubId,
    });

    let url = "";
    if (createResp.ok) {
      console.log(
        `Container created successfully ===> ${createResp.containerId}`
      );

      if (this.stub.config.keepWarmSeconds < 0) {
        console.log(
          "This container has no timeout, it will run until it completes."
        );
      } else {
        console.log(
          `This container will timeout after ${this.stub.config.keepWarmSeconds} seconds.`
        );
      }

      const urlRes = await this.stub.printInvocationSnippet();
      url = urlRes?.url || "";
    }

    return new PodInstance(
      {
        containerId: createResp.containerId,
        url,
        ok: createResp.ok,
        errorMsg: createResp.errorMsg,
      },
      this.stub.client,
      this
    );
  }

  /**
   * Deploy a pod.
   *
   * @param name Optional deployment name. If omitted, uses the pod's configured `name`
   * @returns Deployment details and a success boolean
   *
   * @example
   * ```ts
   * const pod = new Pod(podsManager, undefined, { cpu: 1.0, memory: 128, image: new Image(), keep_warm_seconds: 1000 });
   * const { deployment_details, success } = await pod.deploy("my-pod");
   * ```
   */
  public async deploy(
    name?: string
  ): Promise<{ deployment_details: Record<string, any>; success: boolean }> {
    this.stub.config.name = name || this.stub.config.name;
    if (!this.stub.config.name) {
      console.error(
        "You must specify an app name (either in the constructor or via the name argument)."
      );
    }

    const isCustomImage = !!(
      this.stub.config.image?.config.baseImage ||
      this.stub.config.image?.config.dockerfile
    );

    if (!this.stub.config.entrypoint.length && !isCustomImage) {
      console.error("You must specify an entrypoint.");
      return { deployment_details: {}, success: false };
    }

    let ignorePatterns: string[] = [];
    if (isCustomImage) {
      ignorePatterns = ["**"];
    }

    if (
      !isCustomImage &&
      this.stub.config.entrypoint &&
      this.stub.config.entrypoint.length > 0
    ) {
      this.stub.config.entrypoint = [
        "sh",
        "-c",
        `cd ${USER_CODE_DIR} && ${this.stub.config.entrypoint.join(" ")}`,
      ];
    }
    const prepared = await this.stub.prepareRuntime(
      undefined,
      EStubType.PodDeployment,
      true,
      ignorePatterns
    );
    if (!prepared) {
      return { deployment_details: {}, success: false };
    }

    if (!this.stub.stubId) {
      throw new Error("Stub not created");
    }

    try {
      const req: DeployStubRequest = {
        stubId: this.stub.stubId,
        name: this.stub.config.name || "",
      };

      const deployRes: DeployStubResponse = await this.stub.deployStub(req);

      if (deployRes.ok) {
        console.log("Deployed 🎉");
        // Invokation details func
        if ((this.stub.config.ports?.length || 0) > 0) {
          await this.stub.printInvocationSnippet();
        }
      }

      return {
        deployment_details: {
          deployment_id: deployRes.deploymentId,
          deployment_name: this.stub.config.name,
          invoke_url: deployRes.invokeUrl,
          version: deployRes.version,
        },
        success: deployRes.ok,
      };
    } catch (error) {
      console.error("Failed to deploy pod:", error);
      return { deployment_details: {}, success: false };
    }
  }

  public generateDeploymentArtifacts(options: Record<string, any> = {}): void {
    throw new Error("Not implemented");
  }

  public cleanupDeploymentArtifacts(): void {
    throw new Error("Not implemented");
  }
}

export class PodInstance {
  public containerId: string;
  public url: string;
  public ok: boolean;
  public errorMsg?: string;
  private client: BeamClient;
  public pod: Pod;

  constructor(data: PodInstanceData, client: BeamClient, pod: Pod) {
    this.containerId = data.containerId;
    this.url = data.url;
    this.ok = data.ok;
    this.errorMsg = data.errorMsg;
    this.client = client;
    this.pod = pod;
  }

  public async terminate(): Promise<boolean> {
    const response = await this.client.request({
      method: "POST",
      url: `api/v1/gateway/pods/${this.containerId}/kill`,
      data: {},
    });
    return response.ok;
  }
}
