import HttpClient from "./lib/clients/http";
import {
  Deployment,
  Endpoint,
  TaskQueue,
  ASGI,
  Container,
  Function,
} from "./lib/deployment";
import Task from "./lib/task";

export const GATEWAY_BASE_URL = "http://localhost:1994";

interface initOpts {
  apiToken: string;
  workspaceId: string;
  timeout?: number;
}

const init = (opts: initOpts) => {
  HttpClient.initialize({
    apiToken: opts.apiToken,
    workspaceId: opts.workspaceId,
    timeout: opts.timeout,
    gatewayUrl: GATEWAY_BASE_URL,
  });
};

export {
  init,
  Deployment,
  Task,
  Endpoint,
  TaskQueue,
  ASGI,
  Container,
  Function,
};
