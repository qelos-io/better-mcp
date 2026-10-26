import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ToolView } from "../../../src/manage/api-types";
import { api, serverPath } from "../api";
import { filterTools, toolCounts, withToolsSet, type ToolFilter } from "../lib/tools";
import { toastError } from "../toast";
import { Icon } from "./Icon";

const PAGE = 100;

export function ToolsModal({ server, onClose, onChange }: { server: string; onClose: () => void; onChange: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [tools, setTools] = useState<ToolView[] | null>(null);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<ToolFilter>("all");
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    ref.current?.showModal();
    api<{ tools: ToolView[] }>(serverPath(server, "tools")).then(
      (r) => {
        setTools(r.tools);
        queueMicrotask(() => search.current?.focus());
      },
      (e) => {
        toastError(e);
        onClose();
      },
    );
  }, [server]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setLimit(PAGE), [q, mode]);

  const shown = useMemo(() => (tools ? filterTools(tools, q, mode) : []), [tools, q, mode]);
  const counts = tools ? toolCounts(tools) : { all: 0, enabled: 0, disabled: 0 };

  const set = async (names: string[], enabled: boolean) => {
    if (!tools || !names.length) return;
    const before = tools;
    setTools(withToolsSet(tools, names, enabled));
    try {
      await api(serverPath(server, "tools"), "POST", { tools: names, enabled });
      onChange();
    } catch (e) {
      setTools(before);
      toastError(e);
    }
  };

  const toEnable = shown.filter((t) => !t.enabled).map((t) => t.name);
  const toDisable = shown.filter((t) => t.enabled).map((t) => t.name);
  const MODES: [ToolFilter, string, number][] = [["all", "All", counts.all], ["enabled", "Enabled", counts.enabled], ["disabled", "Disabled", counts.disabled]];

  return (
    <dialog ref={ref} class="wide tools-modal" onClose={onClose} aria-labelledby="tools-title">
      <header class="modal-head">
        <div>
          <h2 id="tools-title">{server} tools</h2>
          <p class="muted">{tools ? `${counts.enabled} of ${counts.all} enabled. Disabled tools are hidden from your AI clients.` : "Loading…"}</p>
        </div>
        <button class="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}><Icon name="x" /></button>
      </header>
      <div class="modal-tools">
        <div class="search">
          <Icon name="search" size={16} />
          <input ref={search} type="search" placeholder="Search tools   ( / )" aria-label="Search tools" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
        </div>
        <div class="segmented" role="group" aria-label="Show">
          {MODES.map(([m, label, n]) => (
            <button type="button" class="seg" aria-pressed={mode === m} onClick={() => setMode(m)} key={m}>{label} <span class="count">{n}</span></button>
          ))}
        </div>
        <div class="bulk">
          <button class="btn" disabled={!toEnable.length} onClick={() => set(toEnable, true)}>Enable {toEnable.length || ""}</button>
          <button class="btn" disabled={!toDisable.length} onClick={() => set(toDisable, false)}>Disable {toDisable.length || ""}</button>
        </div>
      </div>
      <div class="tool-list" aria-busy={!tools}>
        {!tools ? (
          [0, 1, 2, 3, 4].map((i) => <div class="tool-row skeleton" key={i}><div class="bone w40" /></div>)
        ) : shown.length === 0 ? (
          <div class="empty"><p>No tools match.</p><button class="btn" onClick={() => { setQ(""); setMode("all"); }}>Clear filters</button></div>
        ) : (
          shown.slice(0, limit).map((t) => (
            <label class={"tool-row" + (t.enabled ? "" : " off")} key={t.name}>
              <span class="switch">
                <input type="checkbox" role="switch" checked={t.enabled} aria-label={`${t.enabled ? "Disable" : "Enable"} ${t.name}`} onChange={(e) => set([t.name], e.currentTarget.checked)} />
                <span class="track" />
              </span>
              <span class="tool-text">
                <span class="tn">{t.name}</span>
                {t.description && <span class="td" title={t.description}>{t.description}</span>}
              </span>
            </label>
          ))
        )}
        {tools && shown.length > limit && (
          <button class="btn more" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more ({shown.length - limit} left)</button>
        )}
      </div>
      <footer class="modal-foot">
        <span class="muted">Changes save immediately.</span>
        <button class="btn primary" onClick={() => ref.current?.close()}>Done</button>
      </footer>
    </dialog>
  );
}
