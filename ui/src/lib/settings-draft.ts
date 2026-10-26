import {
  SECTIONS,
  buildSectionValue,
  readSection,
  setAt,
  type SectionState,
} from "../../../src/manage/settings-schema";

export type Drafts = Record<string, SectionState>;

/** One editable state per section, from the values the server returned (keyed by section id). */
export function initDrafts(values: Record<string, unknown>): Drafts {
  const raw: Record<string, unknown> = {};
  for (const sec of SECTIONS) if (values[sec.id] !== undefined) setAt(raw, sec.path, values[sec.id]);
  return Object.fromEntries(SECTIONS.map((sec) => [sec.id, readSection(raw, sec)]));
}

/** The patch to save: only sections whose stored value would change; `null` removes a key. */
export function diffPatch(values: Record<string, unknown>, drafts: Drafts): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const sec of SECTIONS) {
    const next = buildSectionValue(sec, drafts[sec.id], values[sec.id]);
    if (JSON.stringify(next) !== JSON.stringify(values[sec.id])) patch[sec.id] = next === undefined ? null : next;
  }
  return patch;
}

export function listToText(list: unknown): string {
  return Array.isArray(list) ? list.join("\n") : "";
}

export function textToList(text: string): string[] {
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

export function parseNumber(text: string): number | undefined {
  if (text.trim() === "") return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}
