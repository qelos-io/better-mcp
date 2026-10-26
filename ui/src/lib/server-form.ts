import type { McpServerConfig } from "../../../src/types/index";

export type ServerKind = "local" | "remote";

export interface ServerForm {
  kind: ServerKind;
  name: string;
  command: string;
  /** One argument per line. */
  args: string;
  /** KEY=value per line. */
  env: string;
  url: string;
  /** Header-Name: value per line. */
  headers: string;
}

export type FormErrors = Partial<Record<keyof ServerForm, string>>;

export const emptyForm = (kind: ServerKind = "local"): ServerForm => ({ kind, name: "", command: "", args: "", env: "", url: "", headers: "" });

export function validateName(name: string, existing: string[]): string | null {
  const n = name.trim();
  if (!n) return "Give the server a name.";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(n)) return "Use letters, digits, - and _, starting with a letter or digit.";
  if (n.includes("__")) return 'The name can\'t contain "__".';
  if (existing.includes(n)) return `A server named "${n}" already exists.`;
  return null;
}

/** Parse "key<sep>value" lines. Returns the first malformed line as an error. */
export function parsePairs(text: string, sep: "=" | ":"): { values: Record<string, string>; error?: string } {
  const values: Record<string, string> = {};
  for (const [i, raw] of text.split("\n").entries()) {
    const line = raw.trim();
    if (!line) continue;
    const at = line.indexOf(sep);
    const key = at > 0 ? line.slice(0, at).trim() : "";
    if (!key) return { values, error: `Line ${i + 1}: expected KEY${sep === "=" ? "=" : ": "}value.` };
    values[key] = line.slice(at + 1).trim();
  }
  return { values };
}

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

/** An http(s) URL; `${VAR}` placeholders are allowed since they are expanded when connecting. */
export function isValidUrl(raw: string): boolean {
  const url = raw.trim();
  if (/^\$\{[^}]+\}$/.test(url)) return true;
  try {
    const u = new URL(url.replace(/\$\{[^}]*\}/g, "x"));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Keys the form edits. Everything else on a config (oauth, cwd, enabled, disabledTools…) is carried over untouched. */
const FORM_KEYS = ["command", "args", "env", "url", "headers"] as const;

export function mergeConfig(base: McpServerConfig | null | undefined, built: McpServerConfig): McpServerConfig {
  const kept: Record<string, unknown> = { ...(base ?? {}) };
  for (const k of FORM_KEYS) delete kept[k];
  return { ...kept, ...built } as McpServerConfig;
}

export function buildConfig(form: ServerForm): { config?: McpServerConfig; errors: FormErrors } {
  const errors: FormErrors = {};
  const config: McpServerConfig = {};
  if (form.kind === "local") {
    if (!form.command.trim()) errors.command = "Enter the command to run, for example npx.";
    else config.command = form.command.trim();
    const args = lines(form.args);
    if (args.length) config.args = args;
    const env = parsePairs(form.env, "=");
    if (env.error) errors.env = env.error;
    else if (Object.keys(env.values).length) config.env = env.values;
  } else {
    if (isValidUrl(form.url)) config.url = form.url.trim();
    else errors.url = "Enter a full http(s) address, for example https://example.com/mcp.";
    const headers = parsePairs(form.headers, ":");
    if (headers.error) errors.headers = headers.error;
    else if (Object.keys(headers.values).length) config.headers = headers.values;
  }
  return Object.keys(errors).length ? { errors } : { config, errors };
}

/** Fill the form from an existing config (marketplace entries, pasted JSON). */
export function formFromConfig(name: string, config: McpServerConfig): ServerForm {
  const remote = typeof config.url === "string";
  return {
    kind: remote ? "remote" : "local",
    name,
    command: config.command ?? "",
    args: (config.args ?? []).join("\n"),
    env: Object.entries(config.env ?? {}).map(([k, v]) => `${k}=${v}`).join("\n"),
    url: config.url ?? "",
    headers: Object.entries(config.headers ?? {}).map(([k, v]) => `${k}: ${v}`).join("\n"),
  };
}
