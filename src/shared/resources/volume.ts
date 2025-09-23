import BeamClient from "../../shared/client";
import {
  GetOrCreateVolumeResponse,
  VolumeGateway,
} from "../../shared/types/volume";

export class Volume {
  public name: string;
  public ready: boolean = false;
  public volumeId?: string;
  public mountPath: string;

  constructor(name: string, mountPath: string) {
    this.name = name;
    this.mountPath = mountPath;
  }

  public async getOrCreate(): Promise<boolean> {
    try {
      const response = await BeamClient.request({
        method: "POST",
        url: "/api/v1/gateway/volumes",
        data: { name: this.name, mount_path: this.mountPath },
      });

      const data = response.data as GetOrCreateVolumeResponse;

      if (data.ok && data.volume) {
        this.ready = true;
        this.volumeId = data.volume.id;
        return true;
      }

      console.error(
        `Failed to get or create volume: ${data.error || "Unknown error"}`
      );
      return false;
    } catch (error) {
      console.error(`Failed to get or create volume ${this.name}:`, error);
      return false;
    }
  }

  public export(): VolumeGateway {
    return {
      id: this.volumeId,
      mountPath: this.mountPath,
    };
  }
}
