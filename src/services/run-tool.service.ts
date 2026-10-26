import type { RunToolResult } from "../manage/api-types.js";
import type { MiddlewarePipeline } from "../middleware/pipeline.js";
import type { ProxyRequest } from "../types/index.js";

/** The slice of an upstream connection a tool run needs. */
export interface RunnableServer {
  name: string;
  allTools: { name: string }[];
  client: { callTool(req: { name: string; arguments: Record<string, unknown> }): Promise<unknown> };
}

/**
 * Call a tool the way a client's call would travel (through the middleware
 * pipeline) and return both the upstream's own response and the processed one,
 * so the effect of redaction, compaction, offloading and so on is visible.
 */
export async function runTool(
  deps: { pipeline: MiddlewarePipeline; server: RunnableServer },
  tool: string,
  args: Record<string, unknown>,
): Promise<RunToolResult> {
  const { pipeline, server } = deps;
  if (!server.allTools.some((t) => t.name === tool)) throw new Error(`unknown tool "${tool}" on "${server.name}"`);
  const req: ProxyRequest = { server: server.name, kind: "tool", name: tool, params: args };
  let raw: unknown;
  let called = false;
  const res = await pipeline.invoke(req, async (r) => {
    raw = await server.client.callTool({ name: r.name, arguments: (r.params ?? {}) as Record<string, unknown> });
    called = true;
    return raw;
  });
  if (res.error) return { durationMs: res.durationMs, error: res.error.message, ...(called ? { raw } : {}), changed: false };
  return { raw, processed: res.result, durationMs: res.durationMs, changed: JSON.stringify(raw) !== JSON.stringify(res.result) };
}
