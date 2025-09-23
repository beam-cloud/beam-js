export interface VolumeGateway {
  id?: string;
  mountPath: string;
}

export interface GetOrCreateVolumeResponse {
  ok: boolean;
  error?: string;
  volume?: { id: string };
}
