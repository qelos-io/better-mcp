import { useState } from "preact/hooks";
import type { Catalog, CatalogEntry } from "../../../src/manage/api-types";
import { categories } from "../lib/servers";
import type { InstallRequest } from "./AddServerDialog";

function Logo({ entry }: { entry: CatalogEntry }) {
  const [broken, setBroken] = useState(false);
  if (entry.logo && !broken) {
    return <img class="logo" src={entry.logo} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} />;
  }
  return <div class="logo" aria-hidden="true">{entry.name[0]?.toUpperCase()}</div>;
}

const SOURCE_NOTE: Record<Catalog["source"], string> = {
  none: "Marketplace unavailable (offline and no bundled copy).",
  bundled: "Showing the bundled catalog (couldn't reach GitHub).",
  remote: "",
};

export function Marketplace(props: { catalog: Catalog; installed: Set<string>; onInstall: (r: InstallRequest) => void }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const needle = q.toLowerCase();
  const shown = props.catalog.entries.filter(
    (e) =>
      (!category || e.category === category) &&
      (!needle || [e.id, e.name, e.description, ...e.tags].join(" ").toLowerCase().includes(needle)),
  );
  const cats = categories(props.catalog.entries);
  return (
    <section>
      <div class="toolbar">
        <input type="search" placeholder="Search marketplace…" aria-label="Search marketplace" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
      </div>
      {cats.length > 1 && (
        <div class="chips" role="group" aria-label="Category">
          <button class="chip" aria-pressed={category === ""} onClick={() => setCategory("")}>All</button>
          {cats.map((c) => (
            <button class="chip" aria-pressed={category === c} onClick={() => setCategory(category === c ? "" : c)} key={c}>{c}</button>
          ))}
        </div>
      )}
      {SOURCE_NOTE[props.catalog.source] && <p class="muted">{SOURCE_NOTE[props.catalog.source]}</p>}
      <p class="summary" aria-live="polite">{shown.length} {shown.length === 1 ? "server" : "servers"}</p>
      {shown.length === 0 ? (
        <div class="empty">
          <p>Nothing matches that search.</p>
          <button class="btn" onClick={() => { setQ(""); setCategory(""); }}>Clear filters</button>
        </div>
      ) : (
        <div class="grid">
          {shown.map((e) => {
            const installed = props.installed.has(e.id);
            return (
              <article class="card" key={e.id}>
                <div class="head">
                  <Logo entry={e} />
                  <div>
                    <div class="name">{e.name}</div>
                    <div class="muted">{e.category}</div>
                  </div>
                </div>
                <p>{e.description}</p>
                {installed ? (
                  <span class="installed">Installed</span>
                ) : (
                  <button class="btn primary" onClick={() => props.onInstall({ name: e.id, config: e.config, title: "Add " + e.name, setup: e.setup ?? "" })}>
                    Add
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
