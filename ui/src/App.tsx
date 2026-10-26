import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { Catalog, ServerView } from "../../src/manage/api-types";
import { ConnectionError, api } from "./api";
import { AddServerDialog, type InstallRequest } from "./components/AddServerDialog";
import { Icon } from "./components/Icon";
import { Marketplace, type CatalogState } from "./components/Marketplace";
import { ServerList } from "./components/ServerList";
import { SettingsPage } from "./components/SettingsPage";
import { Sidebar, TAB_LABEL, type Tab } from "./components/Sidebar";
import { Toasts } from "./components/Toasts";
import { needsAttention } from "./lib/servers";
import { applyTheme, readTheme, type ThemeChoice } from "./lib/theme";

interface State {
  servers: ServerView[];
  persistent: boolean;
}

const SUBTITLE: Record<Tab, string> = {
  servers: "The MCP servers every connected client can use.",
  market: "Community servers you can add in one step.",
  settings: "How better-mcp routes calls and trims what your AI sees.",
};

export function App() {
  const [tab, setTabState] = useState<Tab>(() => (location.hash.slice(1) in TAB_LABEL ? (location.hash.slice(1) as Tab) : "servers"));
  const [theme, setThemeState] = useState<ThemeChoice>(readTheme);
  const [state, setState] = useState<State | null>(null);
  const [offline, setOffline] = useState(false);
  const [catalog, setCatalog] = useState<CatalogState>({ status: "loading" });
  const [install, setInstall] = useState<InstallRequest | null>(null);
  const last = useRef("");
  const misses = useRef(0);

  const setTab = (t: Tab) => {
    setTabState(t);
    history.replaceState(null, "", "#" + t);
  };
  const setTheme = (t: ThemeChoice) => {
    setThemeState(t);
    applyTheme(t);
  };

  const refresh = useCallback(async () => {
    try {
      const next = await api<State>("state");
      misses.current = 0;
      setOffline(false);
      const key = JSON.stringify(next);
      if (key === last.current) return;
      last.current = key;
      setState(next);
    } catch (e) {
      if (e instanceof ConnectionError && ++misses.current >= 2) setOffline(true);
    }
  }, []);

  const loadCatalog = useCallback(() => {
    setCatalog({ status: "loading" });
    api<Catalog>("catalog").then(
      (c) => setCatalog({ status: "ready", catalog: c }),
      (e) => setCatalog({ status: "error", message: e instanceof Error ? e.message : String(e) }),
    );
  }, []);

  useEffect(() => {
    refresh();
    loadCatalog();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh, loadCatalog]);

  const servers = state?.servers ?? [];
  const addCustom = () => setInstall({ name: "", config: null, title: "Add a server", setup: "" });

  return (
    <div class="shell">
      <Sidebar tab={tab} onTab={setTab} attention={servers.filter(needsAttention).length} theme={theme} onTheme={setTheme} />
      <main>
        <header class="page-head">
          <div>
            <h1>{TAB_LABEL[tab]}</h1>
            <p class="muted">{SUBTITLE[tab]}</p>
          </div>
          {tab === "servers" && servers.length > 0 && (
            <button class="btn primary" onClick={addCustom}><Icon name="plus" size={15} /> Add server</button>
          )}
        </header>
        {offline && (
          <div class="banner bad" role="alert">
            <span>Lost connection to better-mcp. It may have restarted: reload your MCP client, then open the management app again.</span>
            <button class="btn" onClick={refresh}>Retry</button>
          </div>
        )}
        {state && !state.persistent && <div class="banner">This config was supplied inline, so changes last only until better-mcp restarts.</div>}
        <div id="panel" role="tabpanel" aria-labelledby={"tab-" + tab}>
          {tab === "settings" ? (
            <SettingsPage onSaved={refresh} />
          ) : tab === "servers" ? (
            <ServerList servers={servers} loading={state === null} onChange={refresh} onAddCustom={addCustom} onBrowse={() => setTab("market")} />
          ) : (
            <Marketplace state={catalog} installed={new Set(servers.map((s) => s.name))} onInstall={setInstall} onRetry={loadCatalog} />
          )}
        </div>
      </main>
      {install && <AddServerDialog request={install} existing={servers.map((s) => s.name)} onClose={() => setInstall(null)} onInstalled={refresh} />}
      <Toasts />
    </div>
  );
}
