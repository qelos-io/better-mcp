import { THEMES, type ThemeChoice } from "../lib/theme";
import { Icon, type IconName } from "./Icon";

export type Tab = "servers" | "market" | "settings";
export const TABS: Tab[] = ["servers", "market", "settings"];
export const TAB_LABEL: Record<Tab, string> = { servers: "Servers", market: "Marketplace", settings: "Settings" };
const TAB_ICON: Record<Tab, IconName> = { servers: "servers", market: "market", settings: "settings" };
const THEME_ICON: Record<ThemeChoice, IconName> = { light: "sun", dark: "moon", system: "monitor" };

export function Sidebar(props: {
  tab: Tab;
  onTab: (t: Tab) => void;
  attention: number;
  theme: ThemeChoice;
  onTheme: (t: ThemeChoice) => void;
}) {
  const onKey = (e: KeyboardEvent) => {
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = TABS[(TABS.indexOf(props.tab) + step + TABS.length) % TABS.length];
    props.onTab(next);
    queueMicrotask(() => document.getElementById("tab-" + next)?.focus());
  };
  return (
    <aside class="sidebar">
      <div class="brand">
        <span class="mark" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.2" /><circle cx="18" cy="6" r="2.2" /><circle cx="12" cy="18" r="2.2" /><path d="M7.6 7.6 11 16M16.4 7.6 13 16M8.2 6h7.6" /></svg>
        </span>
        <span class="brand-name">better-mcp</span>
      </div>
      <nav class="nav" role="tablist" aria-label="Sections" aria-orientation="vertical" onKeyDown={onKey}>
        {TABS.map((t) => (
          <button class="nav-item" role="tab" id={"tab-" + t} aria-controls="panel" aria-selected={props.tab === t} tabIndex={props.tab === t ? 0 : -1} onClick={() => props.onTab(t)} key={t}>
            <Icon name={TAB_ICON[t]} />
            <span>{TAB_LABEL[t]}</span>
            {t === "servers" && props.attention > 0 && <span class="badge" aria-label={`${props.attention} need attention`}>{props.attention}</span>}
          </button>
        ))}
      </nav>
      <div class="theme" role="group" aria-label="Theme">
        {THEMES.map((t) => (
          <button class="theme-btn" aria-pressed={props.theme === t} aria-label={`${t[0].toUpperCase() + t.slice(1)} theme`} title={`${t[0].toUpperCase() + t.slice(1)} theme`} onClick={() => props.onTheme(t)} key={t}>
            <Icon name={THEME_ICON[t]} size={16} />
          </button>
        ))}
      </div>
    </aside>
  );
}
