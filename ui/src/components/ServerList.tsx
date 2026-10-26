import { useState } from "preact/hooks";
import type { ServerView } from "../../../src/manage/api-types";
import { summarize } from "../lib/format";
import { filterServers, needsAttention } from "../lib/servers";
import { ServerRow } from "./ServerRow";

const SEARCH_THRESHOLD = 4;

function Skeleton() {
  return (
    <div class="list" aria-busy="true" aria-label="Loading servers">
      {[0, 1, 2].map((i) => (
        <div class="row skeleton" key={i}>
          <span class="dot" />
          <div class="main"><div class="bone w40" /><div class="bone w70" /></div>
        </div>
      ))}
    </div>
  );
}

export function ServerList(props: {
  servers: ServerView[];
  loading: boolean;
  onChange: () => void;
  onAddCustom: () => void;
  onBrowse: () => void;
}) {
  const { servers } = props;
  const [query, setQuery] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  if (props.loading) return <section><Skeleton /></section>;

  const attention = servers.filter(needsAttention).length;
  const shown = filterServers(servers, query, attentionOnly);
  const filtering = servers.length > SEARCH_THRESHOLD || attentionOnly || query !== "";

  if (servers.length === 0) {
    return (
      <section>
        <div class="empty-state">
          <h2>No MCP servers yet</h2>
          <p class="muted">Add servers once and every client that uses better-mcp gets them.</p>
          <div class="actions">
            <button class="btn primary" onClick={props.onBrowse}>Browse the marketplace</button>
            <button class="btn" onClick={props.onAddCustom}>Add a custom server</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div class="bar">
        <span class="summary" aria-live="polite">{summarize(servers)}</span>
        <button class="btn" onClick={props.onAddCustom}>Add server…</button>
      </div>
      {filtering && (
        <div class="toolbar">
          <input type="search" placeholder="Filter servers…" aria-label="Filter servers" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
          {attention > 0 && (
            <button class="chip" aria-pressed={attentionOnly} onClick={() => setAttentionOnly(!attentionOnly)}>
              Needs attention · {attention}
            </button>
          )}
        </div>
      )}
      <div class="list">
        {shown.length ? (
          shown.map((s) => <ServerRow key={s.name} server={s} onChange={props.onChange} />)
        ) : (
          <div class="empty">
            <p>No servers match.</p>
            <button class="btn" onClick={() => { setQuery(""); setAttentionOnly(false); }}>Clear filters</button>
          </div>
        )}
      </div>
    </section>
  );
}
