import IBase from "./base";
import { EStubType, IStub } from "./stub";

export interface IDeployment extends IBase {
  name: string;
  version: number;
  started_at: string;
  ended_at: string;
  active: boolean;
  stub_type: EStubType;
  stub_id: string;
  stub: IStub;
}
