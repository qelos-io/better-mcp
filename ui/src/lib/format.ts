import type { ServerStatus, ServerView } from "../../../src/manage/api-types";

export const STATUS_LABEL: Record<ServerStatus, string> = {
  connected: "Connected",
  needs_auth: "Needs login",
  authenticating: "Waiting for login…",
  connecting: "Connecting…",
  error: "Error",
  disabled: "Disabled",
};

export function summarize(servers: ServerView[]): string {
  if (!servers.length) return "";
  const n = (st: ServerStatus) => servers.filter((s) => s.status === st).length;
  const parts = ([
    [n("connected"), "connected"],
    [n("authenticating") + n("needs_auth"), "need login"],
    [n("error"), "failing"],
    [n("disabled"), "disabled"],
  ] as const)
    .filter(([c]) => c)
    .map(([c, l]) => `${c} ${l}`);
  return `${servers.length} ${servers.length === 1 ? "server" : "servers"}${parts.length ? " · " + parts.join(" · ") : ""}`;
}

export function countsText(s: ServerView): string {
  if (s.status !== "connected") return "";
  const bits = [s.tools === s.toolsTotal ? `${s.tools} ${s.tools === 1 ? "tool" : "tools"}` : `${s.tools} of ${s.toolsTotal} tools`];
  if (s.resources) bits.push(`${s.resources} resources`);
  if (s.prompts) bits.push(`${s.prompts} prompts`);
  return bits.join(", ");
}

/** The status chip text: the state alone, since tool counts have their own button. */
export function statusLabel(s: ServerView): string {
  return s.finishing ? "Finishing sign-in…" : STATUS_LABEL[s.status] ?? s.status;
}

export function stateLabel(s: ServerView): string {
  const label = s.finishing ? "Finishing sign-in…" : STATUS_LABEL[s.status] ?? s.status;
  const counts = countsText(s);
  return counts ? `${label} · ${counts}` : label;
}

export function loginNotice(s: ServerView): string {
  if (s.finishing) return "Signed in. Connecting and loading tools, this can take a few seconds.";
  return s.loginUrl ? "Finish signing in in your browser. If no window opened, use the login page link." : "Starting login…";
}
