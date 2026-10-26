import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { Catalog, ServerView } from "../../src/manage/api-types";
import { ConnectionError, api } from "./api";
import { AddServerDialog, type InstallRequest } from "./components/AddServerDialog";
import { Marketplace } from "./components/Marketplace";
import { ServerList } from "./components/ServerList";
import { SettingsPage } from "./components/SettingsPage";
import { Toasts } from "./components/Toasts";

interface State {
  servers: ServerView[];
  persistent: boolean;
}

type Tab = "servers" | "market" | "settings";
const TABS: Tab[] = ["servers", "market", "settings"];
const TAB_LABEL: Record<Tab, string> = { servers: "Servers", market: "Marketplace", settings: "Settings" };

export function App() {
  const [tab, setTabState] = useState<Tab>(() => (location.hash.slice(1) in TAB_LABEL ? (location.hash.slice(1) as Tab) : "servers"));
  const [state, setState] = useState<State | null>(null);
  const [offline, setOffline] = useState(false);
  const [catalog, setCatalog] = useState<Catalog>({ entries: [], source: "none" });
  const [install, setInstall] = useState<InstallRequest | null>(null);
  const last = useRef("");
  const misses = useRef(0);

  const setTab = (t: Tab) => {
    setTabState(t);
    history.replaceState(null, "", "#" + t);
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

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    api<Catalog>("catalog").then(setCatalog).catch(() => {});
    return () => clearInterval(t);
  }, [refresh]);

  const onTabKey = (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length];
    setTab(next);
    queueMicrotask(() => document.getElementById("tab-" + next)?.focus());
  };

  const addCustom = () => setInstall({ name: "", config: null, title: "Add a server", setup: "" });

  return (
    <main>
      <div class="top">
        <h1>better-mcp</h1>
        <div class="tabs" role="tablist" aria-label="Sections" onKeyDown={onTabKey}>
          {TABS.map((t) => (
            <button class="tab" role="tab" id={"tab-" + t} aria-controls="panel" aria-selected={tab === t} tabIndex={tab === t ? 0 : -1} onClick={() => setTab(t)} key={t}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      {offline && (
        <div class="banner bad" role="alert">
          <span>Lost connection to better-mcp. It may have restarted: reload your MCP client, then open the management app again.</span>
          <button class="btn" onClick={refresh}>Retry</button>
        </div>
      )}
      {state && !state.persistent && (
        <div class="banner">This config was supplied inline, so changes last only until better-mcp restarts.</div>
      )}
      <div id="panel" role="tabpanel" aria-labelledby={"tab-" + tab}>
        {tab === "settings" ? (
          <SettingsPage onSaved={refresh} />
        ) : tab === "servers" ? (
          <ServerList servers={state?.servers ?? []} loading={state === null} onChange={refresh} onAddCustom={addCustom} onBrowse={() => setTab("market")} />
        ) : (
          <Marketplace catalog={catalog} installed={new Set((state?.servers ?? []).map((s) => s.name))} onInstall={setInstall} />
        )}
      </div>
      {install && (
        <AddServerDialog request={install} existing={(state?.servers ?? []).map((s) => s.name)} onClose={() => setInstall(null)} onInstalled={refresh} />
      )}
      <Toasts />
    </main>
  );
}
