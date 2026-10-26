import { MiddlewarePipeline } from "../middleware/pipeline.js";
import { resolveSlimConfig, type ResolvedSlimConfig } from "../lib/slim.js";
import type { ProxyConfig } from "../types/index.js";

/** What the proxy reads on every request, so settings can change under a running server. */
export interface RuntimeView {
  readonly pipeline: MiddlewarePipeline;
  readonly namespace: boolean;
  readonly slim: ResolvedSlimConfig | null;
  /** Fires after the settings were replaced; returns an unsubscribe function. */
  onChange?(fn: () => void): () => void;
}

export function staticRuntime(pipeline: MiddlewarePipeline, namespace = true, slim: ResolvedSlimConfig | null = null): RuntimeView {
  return { pipeline, namespace, slim };
}

type RuntimeConfig = Pick<ProxyConfig, "middleware" | "namespace">;

/**
 * The live namespace, middleware pipeline and slim settings. `apply` swaps them
 * in one step: a config that fails to build leaves the current settings alone,
 * and calls already in flight finish on the pipeline they started with.
 */
export class RuntimeSettings implements RuntimeView {
  private listeners = new Set<() => void>();

  private constructor(
    public pipeline: MiddlewarePipeline,
    public namespace: boolean,
    public slim: ResolvedSlimConfig | null,
  ) {}

  static async create(config: RuntimeConfig, baseDir: string): Promise<RuntimeSettings> {
    return new RuntimeSettings(
      await MiddlewarePipeline.build(config.middleware, baseDir),
      config.namespace ?? true,
      resolveSlimConfig(config.middleware?.slim),
    );
  }

  async apply(config: RuntimeConfig, baseDir: string): Promise<void> {
    const pipeline = await MiddlewarePipeline.build(config.middleware, baseDir);
    this.pipeline = pipeline;
    this.namespace = config.namespace ?? true;
    this.slim = resolveSlimConfig(config.middleware?.slim);
    for (const fn of [...this.listeners]) {
      try {
        fn();
      } catch {
        /* a bad listener must not break a settings change */
      }
    }
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
}
