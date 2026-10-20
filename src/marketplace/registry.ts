import { parse } from "yaml";
import type { McpServerConfig } from "../types/index.js";

export interface MarketplaceEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  homepage: string;
  logo?: string;
  tags?: string[];
  /** Human-readable setup notes, e.g. which secret to create. */
  setup?: string;
  config: McpServerConfig;
}

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function isHttpsUrl(v: unknown): boolean {
  if (typeof v !== "string") return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

function stringMapErrors(where: string, v: unknown): string[] {
  if (v === undefined) return [];
  if (!isObject(v) || !Object.values(v).every((x) => typeof x === "string")) {
    return [`${where} must be a map of strings`];
  }
  return [];
}

/** Returns a list of human-readable problems with one raw entry (empty = valid). */
export function validateEntry(raw: unknown): string[] {
  if (!isObject(raw)) return ["entry must be a mapping"];
  const errs: string[] = [];
  for (const k of ["id", "name", "description", "category"] as const) {
    if (typeof raw[k] !== "string" || !(raw[k] as string).trim()) errs.push(`${k} is required`);
  }
  if (typeof raw.id === "string" && !ID_RE.test(raw.id)) {
    errs.push("id must be lowercase letters, digits and dashes");
  }
  if (!isHttpsUrl(raw.homepage)) errs.push("homepage must be an https URL");
  if (raw.logo !== undefined && !isHttpsUrl(raw.logo)) errs.push("logo must be an https URL");
  if (raw.tags !== undefined && !(Array.isArray(raw.tags) && raw.tags.every((t) => typeof t === "string"))) {
    errs.push("tags must be a list of strings");
  }
  if (raw.setup !== undefined && typeof raw.setup !== "string") errs.push("setup must be a string");

  const cfg = raw.config;
  if (!isObject(cfg)) {
    errs.push("config is required");
    return errs;
  }
  const hasCmd = typeof cfg.command === "string" && cfg.command !== "";
  const hasUrl = typeof cfg.url === "string" && cfg.url !== "";
  if (hasCmd === hasUrl) errs.push("config needs exactly one of command or url");
  if (hasUrl && !/^https:\/\/|^\$\{/.test(cfg.url as string)) errs.push("config.url must be https");
  if (cfg.args !== undefined && !(Array.isArray(cfg.args) && cfg.args.every((a) => typeof a === "string"))) {
    errs.push("config.args must be a list of strings");
  }
  errs.push(...stringMapErrors("config.env", cfg.env), ...stringMapErrors("config.headers", cfg.headers));
  return errs;
}

/** Parse the YAML registry; throws one error listing every problem found. */
export function parseRegistry(yamlText: string): MarketplaceEntry[] {
  const doc = parse(yamlText) as unknown;
  const list = isObject(doc) ? doc.servers : undefined;
  if (!Array.isArray(list)) throw new Error("registry must have a top-level `servers:` list");

  const problems: string[] = [];
  const seen = new Set<string>();
  list.forEach((raw, i) => {
    const label = isObject(raw) && typeof raw.id === "string" ? raw.id : `#${i + 1}`;
    for (const e of validateEntry(raw)) problems.push(`${label}: ${e}`);
    if (isObject(raw) && typeof raw.id === "string") {
      if (seen.has(raw.id)) problems.push(`${label}: duplicate id`);
      seen.add(raw.id);
    }
  });
  if (problems.length) throw new Error(`invalid marketplace registry:\n  - ${problems.join("\n  - ")}`);

  return (list as MarketplaceEntry[]).slice().sort((a, b) => a.name.localeCompare(b.name));
}
