import { useState } from "preact/hooks";
import type { Catalog, CatalogEntry } from "../../../src/manage/api-types";
import type { InstallRequest } from "./InstallDialog";

function Logo({ entry }: { entry: CatalogEntry }) {
  const [broken, setBroken] = useState(false);
  if (entry.logo && !broken) {
    return <img class="logo" src={entry.logo} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <div class="logo">{entry.name[0]?.toUpperCase()}</div>;
}

const SOURCE_NOTE: Record<Catalog["source"], string> = {
  none: "Marketplace unavailable (offline and no bundled copy).",
  bundled: "Showing the bundled catalog (couldn't reach GitHub).",
  remote: "",
};

export function Marketplace(props: { catalog: Catalog; installed: Set<string>; onInstall: (r: InstallRequest) => void }) {
  const [q, setQ] = useState("");
  const needle = q.toLowerCase();
  const shown = props.catalog.entries.filter(
    (e) => !needle || [e.id, e.name, e.description, ...e.tags].join(" ").toLowerCase().includes(needle),
  );
  return (
    <section>
      <div class="toolbar">
        <input type="search" placeholder="Search marketplace…" aria-label="Search marketplace" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
      </div>
      <p class="muted">{SOURCE_NOTE[props.catalog.source]}</p>
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
              <button
                class="btn primary"
                disabled={installed}
                onClick={() => props.onInstall({ name: e.id, config: e.config, title: "Install " + e.name, setup: e.setup ?? "" })}
              >
                {installed ? "Installed" : "Install"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
