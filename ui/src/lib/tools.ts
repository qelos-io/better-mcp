import type { ToolView } from "../../../src/manage/api-types";

export type ToolFilter = "all" | "enabled" | "disabled";

export function filterTools(tools: ToolView[], query: string, mode: ToolFilter): ToolView[] {
  const q = query.trim().toLowerCase();
  return tools.filter(
    (t) =>
      (mode === "all" || (mode === "enabled") === t.enabled) &&
      (!q || `${t.name} ${t.description ?? ""}`.toLowerCase().includes(q)),
  );
}

export function toolCounts(tools: ToolView[]): { all: number; enabled: number; disabled: number } {
  const enabled = tools.filter((t) => t.enabled).length;
  return { all: tools.length, enabled, disabled: tools.length - enabled };
}

/** Flip `names` to `enabled` without mutating the list. */
export function withToolsSet(tools: ToolView[], names: string[], enabled: boolean): ToolView[] {
  const set = new Set(names);
  return tools.map((t) => (set.has(t.name) ? { ...t, enabled } : t));
}
