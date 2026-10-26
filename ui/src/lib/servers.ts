import type { ServerView } from "../../../src/manage/api-types";

export const needsAttention = (s: ServerView): boolean =>
  s.status === "error" || s.status === "needs_auth" || s.status === "authenticating";

export function filterServers(servers: ServerView[], query: string, onlyAttention: boolean): ServerView[] {
  const q = query.trim().toLowerCase();
  return servers.filter((s) => (!onlyAttention || needsAttention(s)) && (!q || `${s.name} ${s.target}`.toLowerCase().includes(q)));
}

export function categories(entries: { category: string }[]): string[] {
  return [...new Set(entries.map((e) => e.category))].sort((a, b) => a.localeCompare(b));
}
