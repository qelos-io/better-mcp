export function byteSize(value: unknown): number {
  if (value === undefined) return 0;
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** How much smaller (or larger) the processed response is, as a short label. */
export function reduction(rawBytes: number, processedBytes: number): string {
  if (!rawBytes || rawBytes === processedBytes) return "same size";
  const pct = Math.round(((processedBytes - rawBytes) / rawBytes) * 100);
  if (pct === 0) return "same size";
  return pct < 0 ? `${pct}%`.replace("-", "−") : `+${pct}%`;
}

export type Block = { kind: "text"; text: string } | { kind: "other"; label: string };

export interface ResultView {
  isError: boolean;
  blocks: Block[];
}

/** Pretty-print text that is JSON; anything else is returned as it is. */
export function prettyText(text: string): string {
  const t = text.trim();
  if (!(t.startsWith("{") || t.startsWith("["))) return text;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return text;
  }
}

/** The readable parts of an MCP tool result: text blocks as text, other content summarised. */
export function viewResult(result: unknown): ResultView {
  const r = (result && typeof result === "object" ? result : {}) as { isError?: unknown; content?: unknown };
  const content = Array.isArray(r.content) ? (r.content as { type?: string; text?: string; mimeType?: string; resource?: { uri?: string } }[]) : [];
  const blocks: Block[] = content.map((c) => {
    if (c.type === "text" && typeof c.text === "string") return { kind: "text", text: prettyText(c.text) };
    if (c.type === "image") return { kind: "other", label: `Image (${c.mimeType ?? "unknown type"})` };
    if (c.type === "resource") return { kind: "other", label: `Resource ${c.resource?.uri ?? ""}`.trim() };
    return { kind: "other", label: `${c.type ?? "Unknown"} content` };
  });
  return { isError: r.isError === true, blocks };
}
