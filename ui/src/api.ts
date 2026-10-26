const BASE = location.pathname.replace(/\/(index\.html)?$/, "");

/** The management server can't be reached (better-mcp stopped or restarted). */
export class ConnectionError extends Error {
  constructor() {
    super("Can't reach better-mcp.");
  }
}

export async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/${path}`, {
      method,
      headers: { "x-better-mcp": "1", ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ConnectionError();
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
}

export const serverPath = (name: string, sub = "") => `servers/${encodeURIComponent(name)}${sub ? "/" + sub : ""}`;
