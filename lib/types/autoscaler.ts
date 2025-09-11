export const QUEUE_DEPTH_AUTOSCALER_TYPE = "queue_depth";
export const DEFAULT_AUTOSCALER_MAX_CONTAINERS = 1;
export const DEFAULT_AUTOSCALER_TASKS_PER_CONTAINER = 1;
export const DEFAULT_AUTOSCALER_MIN_CONTAINERS = 0;

export interface AutoscalerConfig {
  type?: string;
  maxContainers?: number;
  tasksPerContainer?: number;
  minContainers?: number;
}

export class Autoscaler {
  public maxContainers: number;
  public tasksPerContainer: number;
  public minContainers: number;

  constructor(config: AutoscalerConfig = {}) {
    this.maxContainers = config.maxContainers ?? DEFAULT_AUTOSCALER_MAX_CONTAINERS;
    this.tasksPerContainer = config.tasksPerContainer ?? DEFAULT_AUTOSCALER_TASKS_PER_CONTAINER;
    this.minContainers = config.minContainers ?? DEFAULT_AUTOSCALER_MIN_CONTAINERS;
  }
}

export class QueueDepthAutoscaler extends Autoscaler {
  constructor(config: AutoscalerConfig = {}) {
    super(config);
  }
}

// Map of autoscaler types for lookup - matches Python _AUTOSCALER_TYPES
export const AUTOSCALER_TYPES: Record<string, string> = {
  QueueDepthAutoscaler: QUEUE_DEPTH_AUTOSCALER_TYPE,
};
