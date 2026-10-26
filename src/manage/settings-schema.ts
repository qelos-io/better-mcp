/**
 * Declarative description of the settings the management app can edit, plus the
 * pure helpers that read, build, validate and apply them. Shared by the server
 * (validation, persistence) and the web UI (forms), so it imports nothing at runtime.
 */

export type FieldType = "boolean" | "number" | "string" | "string-list" | "select";

export interface Field {
  key: string;
  label: string;
  help: string;
  type: FieldType;
  default?: boolean | number | string;
  min?: number;
  options?: string[];
  placeholder?: string;
}

export type SectionKind = "flag" | "options" | "list";

export interface Section {
  id: string;
  group: "Routing" | "Token reduction" | "Safety and debugging";
  title: string;
  summary: string;
  /** Config path of the value, e.g. ["middleware", "slim"]. */
  path: string[];
  /** flag: a plain boolean. options: boolean or an object of `fields`. list: an array of strings. */
  kind: SectionKind;
  defaultOn: boolean;
  fields: Field[];
}

const exclude: Field = {
  key: "exclude",
  label: "Exclude",
  help: 'One per line: "<server>" or "<server>__<tool>".',
  type: "string-list",
};

export const SECTIONS: Section[] = [
  {
    id: "namespace",
    group: "Routing",
    title: "Namespace tools",
    summary: 'Prefix every tool and prompt with "<server>__" so names from different servers never collide.',
    path: ["namespace"],
    kind: "flag",
    defaultOn: true,
    fields: [],
  },
  {
    id: "slim",
    group: "Token reduction",
    title: "Slim tool list",
    summary: "Strip JSON-Schema noise from tools/list so clients spend fewer tokens on tool definitions.",
    path: ["middleware", "slim"],
    kind: "options",
    defaultOn: true,
    fields: [
      { key: "stripSchemaFields", label: "Schema fields to strip", help: "One per line. Leave empty for the defaults.", type: "string-list", placeholder: "$schema\n$id\n$comment\ntitle\nexamples\ndefault" },
      { key: "stripPropertyDescriptions", label: "Strip obvious property descriptions", help: "Drop a description that only paraphrases the property name.", type: "boolean", default: false },
      { key: "maxDescriptionLength", label: "Max description length", help: "Truncate tool descriptions to this many characters. 0 disables.", type: "number", default: 0, min: 0 },
    ],
  },
  {
    id: "compact",
    group: "Token reduction",
    title: "Compact responses",
    summary: "Minify JSON inside responses and drop empty fields.",
    path: ["middleware", "compact"],
    kind: "options",
    defaultOn: true,
    fields: [
      { key: "dropNull", label: "Drop null fields", help: "", type: "boolean", default: true },
      { key: "dropEmptyString", label: 'Drop "" fields', help: "", type: "boolean", default: false },
      { key: "dropEmptyArray", label: "Drop [] fields", help: "", type: "boolean", default: false },
      { key: "dropEmptyObject", label: "Drop {} fields", help: "", type: "boolean", default: false },
      { key: "roundFloats", label: "Round numbers to decimals", help: "Lossy for high-precision values such as coordinates. 0 disables.", type: "number", default: 0, min: 0 },
      exclude,
    ],
  },
  {
    id: "cleantext",
    group: "Token reduction",
    title: "Clean text",
    summary: "Remove terminal noise from text responses.",
    path: ["middleware", "cleantext"],
    kind: "options",
    defaultOn: true,
    fields: [
      { key: "stripAnsi", label: "Strip ANSI escape codes", help: "", type: "boolean", default: true },
      { key: "trimTrailingWhitespace", label: "Trim trailing whitespace", help: "", type: "boolean", default: true },
      { key: "collapseBlankLines", label: "Collapse 3+ blank lines to 2", help: "Can alter markdown.", type: "boolean", default: false },
      exclude,
    ],
  },
  {
    id: "dedup",
    group: "Token reduction",
    title: "Deduplicate responses",
    summary: "Replace a response identical to a recent one with a short pointer. Helps polling-style tools.",
    path: ["middleware", "dedup"],
    kind: "options",
    defaultOn: false,
    fields: [
      { key: "ttlSeconds", label: "Remember for (seconds)", help: "", type: "number", default: 300, min: 1 },
      { key: "maxEntries", label: "Max cached entries", help: "", type: "number", default: 1000, min: 1 },
      { key: "minBytes", label: "Minimum response size (bytes)", help: "Smaller responses are never deduplicated.", type: "number", default: 200, min: 0 },
      { key: "includeResources", label: "Also dedup resource reads", help: "", type: "boolean", default: false },
      exclude,
    ],
  },
  {
    id: "offload",
    group: "Token reduction",
    title: "Offload large responses",
    summary: "Write oversize responses to disk and return a short pointer with a preview instead.",
    path: ["middleware", "offload"],
    kind: "options",
    defaultOn: false,
    fields: [
      { key: "thresholdBytes", label: "Offload above (bytes)", help: "", type: "number", default: 16384, min: 0 },
      { key: "dir", label: "Directory", help: "Absolute, or relative to the config file. Default: the system temp folder.", type: "string", placeholder: "/tmp/better-mcp" },
      { key: "includeResources", label: "Also offload resource reads", help: "", type: "boolean", default: false },
      { key: "inferArrayShape", label: "Describe array element shape", help: "", type: "boolean", default: true },
      { key: "previewRows", label: "Preview rows", help: "0 disables the preview.", type: "number", default: 3, min: 0 },
      { key: "chapterMarkdown", label: "Split long markdown by heading", help: "", type: "boolean", default: true },
    ],
  },
  {
    id: "redact",
    group: "Safety and debugging",
    title: "Redact secrets",
    summary: 'Replace the value of any field whose name contains one of these words with "[REDACTED]".',
    path: ["middleware", "redact"],
    kind: "list",
    defaultOn: false,
    fields: [{ key: "list", label: "Field name patterns", help: "One per line, case-insensitive, e.g. password, token, api_key.", type: "string-list" }],
  },
  {
    id: "log",
    group: "Safety and debugging",
    title: "Request log",
    summary: "Log every proxied call.",
    path: ["middleware", "log"],
    kind: "options",
    defaultOn: false,
    fields: [
      { key: "level", label: "Level", help: "", type: "select", options: ["info", "debug"], default: "info" },
      { key: "file", label: "Log file", help: "Leave empty to log to stderr.", type: "string" },
    ],
  },
  {
    id: "trace",
    group: "Safety and debugging",
    title: "Trace files",
    summary: "Write a per-tool JSONL trace of each request through the pipeline.",
    path: ["middleware", "trace"],
    kind: "options",
    defaultOn: false,
    fields: [
      { key: "dir", label: "Directory", help: "Default: <system temp>/better-mcp/trace.", type: "string" },
      { key: "maxBodyBytes", label: "Max body size (bytes)", help: "0 keeps full bodies.", type: "number", default: 0, min: 0 },
      { key: "includeResources", label: "Also trace resources and prompts", help: "", type: "boolean", default: false },
    ],
  },
];

export const RESTART_NOTE = "Saved, but not applied to the running proxy. Restart better-mcp (reload your MCP client) for it to take effect.";

type Raw = Record<string, unknown>;

export function getAt(raw: Raw, path: string[]): unknown {
  let cur: unknown = raw;
  for (const k of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Raw)[k];
  }
  return cur;
}

/** Set (or, for `undefined`, remove) the value at `path`, pruning a `middleware` object left empty. */
export function setAt(raw: Raw, path: string[], value: unknown): void {
  const parents: Raw[] = [raw];
  for (const k of path.slice(0, -1)) {
    const next = parents[parents.length - 1][k];
    if (next === undefined) {
      if (value === undefined) return;
      parents[parents.length - 1][k] = {};
    } else if (!next || typeof next !== "object" || Array.isArray(next)) {
      throw new Error(`"${k}" in the config is not an object`);
    }
    parents.push(parents[parents.length - 1][k] as Raw);
  }
  const leaf = path[path.length - 1];
  const holder = parents[parents.length - 1];
  if (value === undefined) delete holder[leaf];
  else holder[leaf] = value;
  for (let i = path.length - 2; i >= 0; i--) {
    const obj = parents[i + 1];
    if (Object.keys(obj).length === 0) delete parents[i][path[i]];
    else break;
  }
}

export interface SectionState {
  enabled: boolean;
  values: Record<string, unknown>;
}

export function readSection(raw: Raw, sec: Section): SectionState {
  const v = getAt(raw, sec.path);
  if (sec.kind === "list") {
    const list = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    return { enabled: list.length > 0, values: { list } };
  }
  if (v && typeof v === "object" && !Array.isArray(v)) return { enabled: true, values: { ...(v as Raw) } };
  return { enabled: typeof v === "boolean" ? v : sec.defaultOn, values: {} };
}

const blank = (v: unknown) =>
  v === undefined || v === null || v === "" || (typeof v === "number" && Number.isNaN(v)) || (Array.isArray(v) && v.length === 0);

/**
 * The config value to store for a section's edited state, or `undefined` to
 * remove the key. Keys the schema doesn't know (e.g. offload.perTool) survive.
 */
export function buildSectionValue(sec: Section, state: SectionState, existing: unknown): unknown {
  if (sec.kind === "flag") return state.enabled === sec.defaultOn ? undefined : state.enabled;
  if (sec.kind === "list") {
    const list = ((state.values.list as string[] | undefined) ?? []).map((s) => s.trim()).filter(Boolean);
    return state.enabled && list.length ? list : undefined;
  }
  if (!state.enabled) return sec.defaultOn ? false : undefined;
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...(existing as Raw) } : {};
  for (const f of sec.fields) delete base[f.key];
  for (const f of sec.fields) {
    const v = state.values[f.key];
    if (!blank(v)) base[f.key] = v;
  }
  if (Object.keys(base).length === 0) return sec.defaultOn ? undefined : true;
  return base;
}

function checkField(sec: Section, f: Field, v: unknown): void {
  const where = `${sec.id}.${f.key}`;
  switch (f.type) {
    case "boolean":
      if (typeof v !== "boolean") throw new Error(`${where} must be true or false`);
      return;
    case "number":
      if (typeof v !== "number" || !Number.isFinite(v) || (f.min !== undefined && v < f.min)) {
        throw new Error(`${where} must be a number${f.min !== undefined ? ` >= ${f.min}` : ""}`);
      }
      return;
    case "string":
      if (typeof v !== "string") throw new Error(`${where} must be text`);
      return;
    case "select":
      if (typeof v !== "string" || !f.options?.includes(v)) throw new Error(`${where} must be one of ${f.options?.join(", ")}`);
      return;
    case "string-list":
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) throw new Error(`${where} must be a list of text`);
      return;
  }
}

/** Throws a readable error when `value` is not a legal stored value for the section. */
export function validateSectionValue(sec: Section, value: unknown): void {
  if (value === undefined) return;
  if (sec.kind === "flag") {
    if (typeof value !== "boolean") throw new Error(`${sec.id} must be true or false`);
    return;
  }
  if (sec.kind === "list") {
    checkField(sec, sec.fields[0], value);
    return;
  }
  if (typeof value === "boolean") return;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${sec.id} must be true, false or an object`);
  for (const f of sec.fields) {
    const v = (value as Raw)[f.key];
    if (v !== undefined) checkField(sec, f, v);
  }
}

/** `patch` maps a section id to its new stored value; `null` removes the key. All-or-nothing. */
export function applySettingsPatch(raw: Raw, patch: Record<string, unknown>): void {
  const entries = Object.entries(patch).map(([id, value]) => {
    const sec = SECTIONS.find((s) => s.id === id);
    if (!sec) throw new Error(`unknown setting "${id}"`);
    const v = value === null ? undefined : value;
    validateSectionValue(sec, v);
    return [sec, v] as const;
  });
  for (const [sec, v] of entries) setAt(raw, sec.path, v);
}

export function readAllSettings(raw: Raw): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const sec of SECTIONS) {
    const v = getAt(raw, sec.path);
    if (v !== undefined) out[sec.id] = v;
  }
  return out;
}
