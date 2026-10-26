import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { RuntimeView } from "./runtime.service.js";
import type { UpstreamServer } from "./upstream.service.js";
import type { ProxyRequest } from "../types/index.js";
import { VERSION } from "../lib/version.js";
import { slimTool, type ResolvedSlimConfig } from "../lib/slim.js";

const NS_SEPARATOR = "__";

/** A tool implemented by the proxy itself rather than forwarded to an upstream. */
export interface BuiltinTool {
  name: string;
  /** Evaluated on each tools/list so it can reflect live state. */
  description: () => string;
  inputSchema: { type: "object"; [k: string]: unknown };
  call(args: Record<string, unknown>): Promise<{ text: string; isError?: boolean }>;
}

/**
 * Build the array returned by `tools/list`. Pulled out of the request handler
 * so the slim + namespace logic can be unit-tested without an MCP server.
 *
 * Accepts the minimal shape we actually read off each upstream — that keeps
 * tests free to pass plain literals instead of a full `UpstreamServer`.
 */
export interface ListedToolsSource {
  name: string;
  tools: { name: string; description?: string; inputSchema: unknown }[];
}

export function buildListedTools(
  upstreams: ListedToolsSource[],
  namespace: boolean,
  slim: ResolvedSlimConfig | null,
): { name: string; description?: string; inputSchema: { type: "object"; [k: string]: unknown } }[] {
  const out: { name: string; description?: string; inputSchema: { type: "object"; [k: string]: unknown } }[] = [];
  for (const s of upstreams) {
    for (const t of s.tools) {
      const base = {
        name: namespace ? `${s.name}${NS_SEPARATOR}${t.name}` : t.name,
        description: t.description,
        inputSchema: t.inputSchema as { type: "object"; [k: string]: unknown },
      };
      out.push(slim ? (slimTool(base, slim) as typeof base) : base);
    }
  }
  return out;
}

/**
 * Build maps from public (possibly-namespaced) name → owning upstream + original name.
 * For resources the public identifier is the URI; we don't rewrite URIs because they
 * are opaque to clients, but we do detect collisions across servers.
 */
export function buildRoutes(servers: UpstreamServer[], namespace: boolean, quiet = false) {
  const warn = quiet ? () => {} : warnMsg;
  const tools = new Map<string, { server: UpstreamServer; originalName: string }>();
  const prompts = new Map<string, { server: UpstreamServer; originalName: string }>();
  const resources = new Map<string, UpstreamServer>();

  for (const s of servers) {
    for (const t of s.tools) {
      const publicName = namespace ? `${s.name}${NS_SEPARATOR}${t.name}` : t.name;
      if (tools.has(publicName)) {
        warn(`tool name collision on "${publicName}" — ${s.name} overrides previous owner`);
      }
      tools.set(publicName, { server: s, originalName: t.name });
    }
    for (const p of s.prompts) {
      const publicName = namespace ? `${s.name}${NS_SEPARATOR}${p.name}` : p.name;
      if (prompts.has(publicName)) {
        warn(`prompt name collision on "${publicName}" — ${s.name} overrides previous owner`);
      }
      prompts.set(publicName, { server: s, originalName: p.name });
    }
    for (const r of s.resources) {
      if (resources.has(r.uri)) {
        warn(`resource URI collision on "${r.uri}" — ${s.name} overrides previous owner`);
      }
      resources.set(r.uri, s);
    }
  }
  return { tools, prompts, resources };
}

/**
 * Wire up the proxy MCP server. Returns the configured McpServer (not yet listening)
 * so the caller can attach the transport and start it.
 *
 * Uses the underlying `server` for request handlers so upstream JSON Schemas are
 * forwarded unchanged (McpServer.registerTool only accepts Zod shapes).
 */
export function buildProxyServer(opts: {
  upstreams: UpstreamServer[];
  runtime: RuntimeView;
  builtins?: BuiltinTool[];
  /** Subscribe to upstream set changes; returns an unsubscribe function. */
  onUpstreamsChange?: (fn: () => void) => () => void;
}): McpServer {
  const { upstreams, runtime } = opts;
  const builtins = new Map((opts.builtins ?? []).map((b) => [b.name, b]));
  let routes = buildRoutes(upstreams, runtime.namespace);

  const mcp = new McpServer(
    { name: "@qelos/better-mcp", version: VERSION },
    {
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
        prompts: { listChanged: true },
      },
    },
  );
  const server = mcp.server;

  const announce = () => {
    routes = buildRoutes(upstreams, runtime.namespace, true);
    for (const notify of [
      () => server.sendToolListChanged(),
      () => server.sendResourceListChanged(),
      () => server.sendPromptListChanged(),
    ]) {
      // Not connected yet / already closed: nobody to tell.
      notify().catch(() => {});
    }
  };
  const unsubscribe = [opts.onUpstreamsChange?.(announce), runtime.onChange?.(announce)].filter(
    (off): off is () => void => !!off,
  );
  if (unsubscribe.length) {
    const prev = server.onclose;
    server.onclose = () => {
      for (const off of unsubscribe) off();
      prev?.();
    };
  }

  // ---- tools ---------------------------------------------------------------

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const own = [...builtins.values()].map((b) => ({
      name: b.name,
      description: b.description(),
      inputSchema: b.inputSchema,
    }));
    return { tools: [...own, ...buildListedTools(upstreams, runtime.namespace, runtime.slim)] };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const publicName = req.params.name;
    const builtin = builtins.get(publicName);
    if (builtin) {
      const out = await builtin.call((req.params.arguments ?? {}) as Record<string, unknown>);
      return { content: [{ type: "text" as const, text: out.text }], isError: out.isError === true };
    }
    const route = routes.tools.get(publicName);
    if (!route) throw new Error(`Unknown tool: ${publicName}`);

    const proxyReq: ProxyRequest = {
      server: route.server.name,
      kind: "tool",
      name: route.originalName,
      params: req.params.arguments,
    };
    const res = await runtime.pipeline.invoke(proxyReq, async (r) =>
      route.server.client.callTool({
        name: r.name,
        arguments: (r.params ?? {}) as Record<string, unknown>,
      }),
    );
    if (res.error) throw new Error(res.error.message);
    return res.result as Record<string, unknown>;
  });

  // ---- resources -----------------------------------------------------------

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources = [];
    for (const s of upstreams) {
      for (const r of s.resources) {
        resources.push({
          uri: r.uri,
          name: r.name,
          description: r.description,
          mimeType: r.mimeType,
        });
      }
    }
    return { resources };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const uri = req.params.uri;
    const owner = routes.resources.get(uri);
    if (!owner) throw new Error(`Unknown resource: ${uri}`);

    const proxyReq: ProxyRequest = {
      server: owner.name,
      kind: "resource",
      name: uri,
      params: { uri },
    };
    const res = await runtime.pipeline.invoke(proxyReq, async () => owner.client.readResource({ uri }));
    if (res.error) throw new Error(res.error.message);
    return res.result as Record<string, unknown>;
  });

  // ---- prompts -------------------------------------------------------------

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    const prompts = [];
    for (const s of upstreams) {
      for (const p of s.prompts) {
        prompts.push({
          name: runtime.namespace ? `${s.name}${NS_SEPARATOR}${p.name}` : p.name,
          description: p.description,
          arguments: p.arguments as { name: string; description?: string; required?: boolean }[] | undefined,
        });
      }
    }
    return { prompts };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (req) => {
    const publicName = req.params.name;
    const route = routes.prompts.get(publicName);
    if (!route) throw new Error(`Unknown prompt: ${publicName}`);

    const proxyReq: ProxyRequest = {
      server: route.server.name,
      kind: "prompt",
      name: route.originalName,
      params: req.params.arguments,
    };
    const res = await runtime.pipeline.invoke(proxyReq, async (r) =>
      route.server.client.getPrompt({
        name: r.name,
        arguments: (r.params ?? {}) as Record<string, string>,
      }),
    );
    if (res.error) throw new Error(res.error.message);
    return res.result as Record<string, unknown>;
  });

  return mcp;
}

/** Connect the proxy to the stdio transport and start serving. */
export async function startProxy(mcp: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await mcp.connect(transport);
}

function warnMsg(msg: string): void {
  process.stderr.write(`[better-mcp] ${msg}\n`);
}
