import BeamClient from "..";
import {
  GetOrCreateVolumeRequest,
  GetOrCreateVolumeResponse,
  VolumeGateway,
  CloudBucketConfig,
  VolumeConfigGateway,
} from "../types/volume";

export class Volume {
  public name: string;
  public ready: boolean = false;
  public volumeId?: string;
  public mountPath: string;
  protected client?: BeamClient;

  constructor(name: string, mountPath: string) {
    /**
     * Creates a Volume instance.
     *
     * When your container runs, your volume will be available at `./{name}` and `/volumes/{name}`.
     *
     * Parameters:
     *   name: The name of the volume, a descriptive identifier for the data volume.
     *         Note that when using an external provider, the name must be the same as the bucket name.
     *   mountPath: The path where the volume is mounted within the container environment.
     *
     * Example:
     *   ```typescript
     *   import { Volume } from "beam-js";
     *
     *   // Shared Volume
     *   const sharedVolume = new Volume("model_weights", "./my-weights");
     *
     *   const runner = new RunnerAbstraction({
     *     volumes: [sharedVolume]
     *   });
     *   ```
     */
    this.name = name;
    this.mountPath = mountPath;
  }

  public setClient(client: BeamClient): void {
    this.client = client;
  }

  public async getOrCreate(): Promise<boolean> {
    if (!this.client) {
      console.error("Client not set. Call setClient() first.");
      return false;
    }

    try {
      const response = await this.client.request({
        method: "POST",
        url: "/api/v1/gateway/volumes",
        data: {
          name: this.name,
        } as GetOrCreateVolumeRequest,
      });

      const data = response.data as GetOrCreateVolumeResponse;

      if (data.ok && data.volume) {
        this.ready = true;
        this.volumeId = data.volume.id;
        return true;
      }

      console.error(`Failed to get or create volume: ${data.error || 'Unknown error'}`);
      return false;
    } catch (error) {
      console.error(`Failed to get or create volume ${this.name}:`, error);
      return false;
    }
  }

  public export(): VolumeGateway {
    return {
      id: this.volumeId,
      mount_path: this.mountPath,
    };
  }
}

export class CloudBucket extends Volume {
  public config: CloudBucketConfig;

  constructor(name: string, mountPath: string, config: CloudBucketConfig) {
    /**
     * Creates a CloudBucket instance.
     *
     * When your container runs, your cloud bucket will be available at `./{name}` and `/volumes/{name}`.
     *
     * Parameters:
     *   name: The name of the cloud bucket, must be the same as the bucket name in the cloud provider.
     *   mountPath: The path where the cloud bucket is mounted within the container environment.
     *   config: Configuration for the cloud bucket.
     *
     * Example:
     *   ```typescript
     *   import { CloudBucket } from "beam-js";
     *
     *   // Cloud Bucket
     *   const cloudBucket = new CloudBucket(
     *     "other_model_weights",
     *     "./other-weights",
     *     {
     *       accessKey: "MY_ACCESS_KEY_SECRET",
     *       secretKey: "MY_SECRET_KEY_SECRET",
     *       endpoint: "https://s3-endpoint.com",
     *     }
     *   );
     *
     *   const runner = new RunnerAbstraction({
     *     volumes: [cloudBucket]
     *   });
     *   ```
     */
    super(name, mountPath);
    this.config = config;
  }

  public async getOrCreate(): Promise<boolean> {
    // Cloud buckets don't need to be created, they already exist
    return true;
  }

  public export(): VolumeGateway {
    const vol = super.export();
    vol.config = {
      bucketName: this.name,
      accessKey: this.config.accessKey,
      secretKey: this.config.secretKey,
      endpointUrl: this.config.endpoint,
      region: this.config.region,
      readOnly: this.config.readOnly,
      forcePathStyle: this.config.forcePathStyle,
    } as VolumeConfigGateway;
    return vol;
  }
}

// Legacy Volumes API resource for backwards compatibility
export class Volumes {
  private client: BeamClient;

  constructor(client: BeamClient) {
    this.client = client;
  }

  public create(name: string, mountPath: string): Volume {
    const volume = new Volume(name, mountPath);
    volume.setClient(this.client);
    return volume;
  }

  public createCloudBucket(name: string, mountPath: string, config: CloudBucketConfig): CloudBucket {
    const bucket = new CloudBucket(name, mountPath, config);
    bucket.setClient(this.client);
    return bucket;
  }
}