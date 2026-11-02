import type { InstallInfo, RunToolResult, ServerView, ToolDetail, ToolView } from "../manage/api-types.js";
import type { DescribableTool } from "./call-args.js";

export interface BackendServer {
  name: string;
  tools: { name: string; description?: string }[];
}

/** What the `tools` commands need, whether served in-process or by a running better-mcp. */
export interface ToolsBackend {
  /** Connected servers with their enabled tools. */
  servers(): Promise<BackendServer[]>;
  namespace(): Promise<boolean>;
  detail(server: string, tool: string): Promise<DescribableTool>;
  call(server: string, tool: string, args: Record<string, unknown>): Promise<RunToolResult>;
  /** Servers that are not connected and why, to explain a missing tool. */
  problems(): Promise<string[]>;
  close(): Promise<void>;
}

export function describeProblems(views: Pick<ServerView, "name" | "status" | "error">[]): string[] {
  return views
    .filter((v) => v.status !== "connected" && v.status !== "disabled")
    .map((v) => `${v.name}: ${v.error ? v.error : v.status === "needs_auth" ? "needs login (open the app)" : v.status}`);
}

/** Talks to the management API of a running better-mcp (`app` or the background helper). */
export function httpBackend(baseUrl: string, fetchFn: typeof fetch = fetch): ToolsBackend {
  const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
  const req = async <T>(path: string, body?: unknown, timeoutMs = 0): Promise<T> => {
    const res = await fetchFn(base + "api/" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "content-type": "application/json", "x-better-mcp": "1" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json;
  };
  const state = () => req<{ servers: ServerView[] }>("state").then((s) => s.servers);
  const enc = encodeURIComponent;
  return {
    async servers() {
      const connected = (await state()).filter((v) => v.status === "connected");
      return Promise.all(
        connected.map(async (v) => ({
          name: v.name,
          tools: (await req<{ tools: ToolView[] }>(`servers/${enc(v.name)}/tools`)).tools.filter((t) => t.enabled),
        })),
      );
    },
    namespace: async () => (await req<InstallInfo>("install")).namespace,
    detail: (server, tool) => req<ToolDetail>(`servers/${enc(server)}/tools/${enc(tool)}`),
    call: (server, tool, args) => req<RunToolResult>(`servers/${enc(server)}/tools/${enc(tool)}/call`, { arguments: args }),
    problems: async () => describeProblems(await state()),
    close: async () => {},
  };
}

/** Cheap liveness probe for a registered process. */
export async function ping(baseUrl: string, fetchFn: typeof fetch = fetch, timeoutMs = 2000): Promise<boolean> {
  try {
    const res = await fetchFn(baseUrl.replace(/\/?$/, "/") + "api/state", { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok;
  } catch {
    return false;
  }
}
