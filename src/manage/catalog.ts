import { readFile } from "node:fs/promises";
import type { McpServerConfig } from "../types/index.js";
import type { Catalog, CatalogEntry } from "./api-types.js";

export type { Catalog, CatalogEntry };

export const DEFAULT_CATALOG_URL =
  "https://raw.githubusercontent.com/qelos-io/better-mcp/main/docs/marketplace/servers.json";

/** Keep only well-formed entries; a malformed community entry must not break the page. */
export function parseCatalog(json: unknown): CatalogEntry[] {
  if (!Array.isArray(json)) return [];
  return json.filter((e): e is CatalogEntry => {
    if (typeof e !== "object" || e === null) return false;
    const x = e as Record<string, unknown>;
    const cfg = x.config as Record<string, unknown> | undefined;
    return (
      typeof x.id === "string" &&
      typeof x.name === "string" &&
      typeof x.description === "string" &&
      typeof x.category === "string" &&
      typeof x.homepage === "string" &&
      typeof cfg === "object" &&
      cfg !== null &&
      (typeof cfg.command === "string" || typeof cfg.url === "string")
    );
  }).map((e) => ({ ...e, logo: e.logo ?? null, tags: e.tags ?? [], setup: e.setup ?? null }));
}

export interface LoadCatalogOptions {
  /** Remote JSON URL, or `false` to stay offline. */
  url?: string | false;
  /** Path to a bundled copy used when the remote is unreachable. */
  bundledPath?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function loadCatalog(opts: LoadCatalogOptions = {}): Promise<Catalog> {
  const url = opts.url === undefined ? DEFAULT_CATALOG_URL : opts.url;
  if (url) {
    try {
      const res = await (opts.fetchImpl ?? fetch)(url, {
        signal: AbortSignal.timeout(opts.timeoutMs ?? 4000),
      });
      if (res.ok) {
        const entries = parseCatalog(await res.json());
        if (entries.length) return { entries, source: "remote" };
      }
    } catch {
      /* fall through to the bundled copy */
    }
  }
  if (opts.bundledPath) {
    try {
      const entries = parseCatalog(JSON.parse(await readFile(opts.bundledPath, "utf8")));
      if (entries.length) return { entries, source: "bundled" };
    } catch {
      /* no bundled copy */
    }
  }
  return { entries: [], source: "none" };
}
