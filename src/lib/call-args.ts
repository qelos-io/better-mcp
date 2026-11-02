const NS_SEPARATOR = "__";

/** Parse the JSON-object arguments for `better-mcp call`; empty input means no arguments. */
export function parseCallArgs(text: string | undefined): Record<string, unknown> {
  const src = (text ?? "").trim();
  if (!src) return {};
  let value: unknown;
  try {
    value = JSON.parse(src);
  } catch (e) {
    throw new Error(`arguments are not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("arguments must be a JSON object, e.g. '{\"key\": \"value\"}'");
  }
  return value as Record<string, unknown>;
}

export interface CallableServer {
  name: string;
  tools: { name: string }[];
}

/**
 * Find the upstream and original tool name for what the user typed: the public
 * name (`server__tool` when namespacing is on), or a bare tool name when only
 * one server has it.
 */
export function resolveCallTool<S extends CallableServer>(
  servers: S[],
  namespace: boolean,
  typed: string,
): { server: S; tool: string } {
  const matches: { server: S; tool: string }[] = [];
  for (const s of servers) {
    for (const t of s.tools) {
      const pub = namespace ? `${s.name}${NS_SEPARATOR}${t.name}` : t.name;
      if (typed === pub) return { server: s, tool: t.name };
      if (typed === t.name) matches.push({ server: s, tool: t.name });
    }
  }
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const names = matches.map((m) => (namespace ? `${m.server.name}${NS_SEPARATOR}${m.tool}` : m.tool));
    throw new Error(`"${typed}" is ambiguous; use one of: ${names.join(", ")}`);
  }
  throw new Error(`unknown tool "${typed}"`);
}

export interface DescribableTool {
  name: string;
  description?: string;
  inputSchema: unknown;
  annotations?: Record<string, unknown>;
}

/** What `tools describe` prints: the public name plus the description and input schema. */
export function describeTool(server: string, tool: DescribableTool, namespace: boolean) {
  return {
    name: namespace ? `${server}${NS_SEPARATOR}${tool.name}` : tool.name,
    server,
    description: tool.description ?? "",
    inputSchema: tool.inputSchema,
    ...(tool.annotations ? { annotations: tool.annotations } : {}),
  };
}

/**
 * The public names of callable tools, sorted. Filters are case-insensitive
 * substrings matched against the public name or the description; a tool is
 * kept when it matches any filter (no filters keeps everything).
 */
export function listToolNames(
  servers: { name: string; tools: { name: string; description?: string }[] }[],
  namespace: boolean,
  filters: string[] = [],
): string[] {
  const needles = filters.map((f) => f.toLowerCase());
  return servers
    .flatMap((s) =>
      s.tools.flatMap((t) => {
        const name = namespace ? `${s.name}${NS_SEPARATOR}${t.name}` : t.name;
        const hay = `${name}\n${t.description ?? ""}`.toLowerCase();
        return needles.length === 0 || needles.some((n) => hay.includes(n)) ? [name] : [];
      }),
    )
    .sort();
}
