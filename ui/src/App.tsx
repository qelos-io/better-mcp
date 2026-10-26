import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { Catalog, ServerView } from "../../src/manage/api-types";
import { api } from "./api";
import { InstallDialog, type InstallRequest } from "./components/InstallDialog";
import { Marketplace } from "./components/Marketplace";
import { ServerList } from "./components/ServerList";
import { useToast } from "./toast";

interface State {
  servers: ServerView[];
  persistent: boolean;
}

type Tab = "servers" | "market";

export function App() {
  const [tab, setTab] = useState<Tab>("servers");
  const [state, setState] = useState<State>({ servers: [], persistent: true });
  const [catalog, setCatalog] = useState<Catalog>({ entries: [], source: "none" });
  const [install, setInstall] = useState<InstallRequest | null>(null);
  const last = useRef("");
  const toast = useToast();

  const refresh = useCallback(async () => {
    try {
      const next = await api<State>("state");
      const key = JSON.stringify(next);
      if (key === last.current) return;
      last.current = key;
      setState(next);
    } catch {
      /* transient: keep showing the last state */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    api<Catalog>("catalog").then(setCatalog).catch(() => {});
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <main>
      <div class="top">
        <h1>better-mcp</h1>
        <div class="tabs" role="tablist">
          {(["servers", "market"] as const).map((t) => (
            <button class="tab" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t === "servers" ? "Servers" : "Marketplace"}
            </button>
          ))}
        </div>
      </div>
      {!state.persistent && (
        <div class="banner">This config was supplied inline, so changes last only until better-mcp restarts.</div>
      )}
      {tab === "servers" ? (
        <ServerList
          servers={state.servers}
          onChange={refresh}
          onAddCustom={() => setInstall({ name: "", config: { command: "npx", args: ["-y", "some-mcp-server"] }, title: "Add custom server", setup: "" })}
        />
      ) : (
        <Marketplace
          catalog={catalog}
          installed={new Set(state.servers.map((s) => s.name))}
          onInstall={setInstall}
        />
      )}
      {install && <InstallDialog request={install} onClose={() => setInstall(null)} onInstalled={refresh} />}
      {toast && <div class="toast" role="status">{toast}</div>}
    </main>
  );
}
