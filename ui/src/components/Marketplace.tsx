import { useState } from "preact/hooks";
import type { Catalog, CatalogEntry } from "../../../src/manage/api-types";
import { categories } from "../lib/servers";
import type { InstallRequest } from "./AddServerDialog";
import { Icon } from "./Icon";

function Logo({ entry }: { entry: CatalogEntry }) {
  const [broken, setBroken] = useState(false);
  if (entry.logo && !broken) {
    return <img class="logo" src={entry.logo} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} />;
  }
  return <div class="logo" aria-hidden="true">{entry.name[0]?.toUpperCase()}</div>;
}

export type CatalogState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; catalog: Catalog };

const SOURCE_NOTE: Record<Catalog["source"], string> = {
  none: "Marketplace unavailable (offline and no bundled copy).",
  bundled: "Showing the bundled catalog (couldn't reach GitHub).",
  remote: "",
};

export function Marketplace(props: { state: CatalogState; installed: Set<string>; onInstall: (r: InstallRequest) => void; onRetry: () => void }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const { state } = props;

  if (state.status === "loading") {
    return <div class="grid" aria-busy="true">{[0, 1, 2, 3, 4, 5].map((i) => <div class="card skeleton" key={i}><div class="bone w40" /><div class="bone w70" /><div class="bone w40" /></div>)}</div>;
  }
  if (state.status === "error") {
    return (
      <div class="empty-state">
        <h2>Couldn't load the marketplace</h2>
        <p class="muted">{state.message}</p>
        <div class="row-actions"><button class="btn primary" onClick={props.onRetry}>Try again</button></div>
      </div>
    );
  }

  const { catalog } = state;
  const needle = q.toLowerCase();
  const shown = catalog.entries.filter(
    (e) => (!category || e.category === category) && (!needle || [e.id, e.name, e.description, ...e.tags].join(" ").toLowerCase().includes(needle)),
  );
  const cats = categories(catalog.entries);
  return (
    <>
      <div class="filters">
        <div class="search">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Search servers" aria-label="Search marketplace" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
        </div>
      </div>
      {cats.length > 1 && (
        <div class="chips" role="group" aria-label="Category">
          <button class="chip" aria-pressed={category === ""} onClick={() => setCategory("")}>All</button>
          {cats.map((c) => <button class="chip" aria-pressed={category === c} onClick={() => setCategory(category === c ? "" : c)} key={c}>{c}</button>)}
        </div>
      )}
      {SOURCE_NOTE[catalog.source] && <p class="note">{SOURCE_NOTE[catalog.source]}</p>}
      {catalog.entries.length === 0 ? (
        <div class="empty-state"><h2>The marketplace is empty</h2><p class="muted">No catalog could be loaded. You can still add a server by hand.</p><div class="row-actions"><button class="btn" onClick={props.onRetry}>Try again</button></div></div>
      ) : shown.length === 0 ? (
        <div class="empty"><p>Nothing matches that search.</p><button class="btn" onClick={() => { setQ(""); setCategory(""); }}>Clear filters</button></div>
      ) : (
        <div class="grid">
          {shown.map((e) => {
            const installed = props.installed.has(e.id);
            return (
              <article class="card" key={e.id}>
                <div class="head">
                  <Logo entry={e} />
                  <div><div class="name">{e.name}</div><div class="muted small">{e.category}</div></div>
                </div>
                <p>{e.description}</p>
                {installed ? (
                  <span class="installed"><Icon name="check" size={14} /> Installed</span>
                ) : (
                  <button class="btn" onClick={() => props.onInstall({ name: e.id, config: e.config, title: "Add " + e.name, setup: e.setup ?? "" })}><Icon name="plus" size={14} /> Add</button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
