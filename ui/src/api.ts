const BASE = location.pathname.replace(/\/(index\.html)?$/, "");

export async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api/${path}`, {
    method,
    headers: { "x-better-mcp": "1", ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
}

export const serverPath = (name: string, sub = "") => `servers/${encodeURIComponent(name)}${sub ? "/" + sub : ""}`;
