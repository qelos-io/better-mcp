import { useEffect, useState } from "preact/hooks";
import type { ToolView } from "../../../src/manage/api-types";
import { api, serverPath } from "../api";
import { matchesFilter } from "../lib/format";
import { toast } from "../toast";

export function ToolsPanel({ server, onChange }: { server: string; onChange: () => void }) {
  const [tools, setTools] = useState<ToolView[] | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    try {
      setTools((await api<{ tools: ToolView[] }>(serverPath(server, "tools"))).tools);
    } catch (e) {
      toast((e as Error).message);
    }
  };
  useEffect(() => void load(), [server]);

  const set = async (names: string[], enabled: boolean) => {
    if (!names.length) return;
    try {
      await api(serverPath(server, "tools"), "POST", { tools: names, enabled });
    } catch (e) {
      toast((e as Error).message);
    }
    await load();
    onChange();
  };

  if (!tools) return <div class="tools"><p class="muted">Loading tools…</p></div>;
  const shown = tools.filter((t) => matchesFilter(t, q));
  return (
    <div class="tools">
      <div class="tools-bar">
        <input type="search" placeholder="Filter tools…" aria-label="Filter tools" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
        <button class="btn" onClick={() => set(shown.filter((t) => !t.enabled).map((t) => t.name), true)}>Enable all</button>
        <button class="btn" onClick={() => set(shown.filter((t) => t.enabled).map((t) => t.name), false)}>Disable all</button>
      </div>
      <div class="tools-list">
        {shown.length ? (
          shown.map((t) => (
            <label class={"tool" + (t.enabled ? "" : " off")} key={t.name}>
              <input type="checkbox" checked={t.enabled} onChange={(e) => set([t.name], e.currentTarget.checked)} />
              <span class="tn">{t.name}</span>
              <span class="td">{t.description ?? ""}</span>
            </label>
          ))
        ) : (
          <p class="muted">No tools match.</p>
        )}
      </div>
    </div>
  );
}
