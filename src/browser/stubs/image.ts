// Browser stub: this class is Node-only in functionality
export class Image {
  constructor(_: any = {}) {}
  static async fromDockerfile(): Promise<Image> {
    throw new Error(
      "Image.fromDockerfile is Node-only and unavailable in the browser build."
    );
  }
  static fromRegistry(): Image {
    throw new Error(
      "Image.fromRegistry is Node-only and unavailable in the browser build."
    );
  }
  async build(): Promise<any> {
    throw new Error(
      "Image.build is Node-only and unavailable in the browser build."
    );
  }
}
