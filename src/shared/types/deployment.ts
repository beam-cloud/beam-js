import BaseData from "./base";

export interface DeploymentData extends BaseData {
  name: string;
  stubType: string;
  version: number;
}
