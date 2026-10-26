import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

/** Map a URL sub-path to a file under `root`; null when it would escape the root. */
export function resolveStaticPath(root: string, sub: string): string | null {
  const rel = normalize(sub === "" ? "index.html" : decodeURIComponent(sub));
  if (rel.startsWith("..") || rel.includes(`..${sep}`) || rel.includes("\0") || rel.startsWith(sep)) return null;
  return join(root, rel);
}

export async function readStatic(
  root: string,
  sub: string,
): Promise<{ body: Buffer; type: string } | null> {
  let file: string | null;
  try {
    file = resolveStaticPath(root, sub);
  } catch {
    return null;
  }
  if (!file) return null;
  try {
    return { body: await readFile(file), type: TYPES[extname(file)] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

export const UI_MISSING_HTML =
  "<!doctype html><title>better-mcp</title><p>The management UI is not built. Run <code>npm run build</code> and restart.</p>";
