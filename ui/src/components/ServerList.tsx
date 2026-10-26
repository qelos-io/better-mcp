import { useState } from "preact/hooks";
import type { ServerView } from "../../../src/manage/api-types";
import { filterServers, needsAttention } from "../lib/servers";
import { Icon } from "./Icon";
import { ServerRow } from "./ServerRow";
import { ToolsModal } from "./ToolsModal";

const SEARCH_THRESHOLD = 4;

function Skeleton() {
  return (
    <div class="panel" aria-busy="true" aria-label="Loading servers">
      {[0, 1, 2].map((i) => (
        <div class="server skeleton" key={i}>
          <div class="ident"><div class="bone w40" /><div class="bone w70" /></div>
        </div>
      ))}
    </div>
  );
}

export function ServerList(props: {
  servers: ServerView[];
  loading: boolean;
  onChange: () => void;
  onBrowse: () => void;
  onAddCustom: () => void;
}) {
  const { servers } = props;
  const [query, setQuery] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [toolsFor, setToolsFor] = useState<string | null>(null);
  if (props.loading) return <Skeleton />;

  if (servers.length === 0) {
    return (
      <div class="empty-state">
        <h2>No MCP servers yet</h2>
        <p class="muted">Add servers once and every client that uses better-mcp gets them.</p>
        <div class="row-actions">
          <button class="btn primary" onClick={props.onBrowse}>Browse the marketplace</button>
          <button class="btn" onClick={props.onAddCustom}>Add a custom server</button>
        </div>
      </div>
    );
  }

  const attention = servers.filter(needsAttention).length;
  const shown = filterServers(servers, query, attentionOnly);
  const showFilters = servers.length > SEARCH_THRESHOLD || attentionOnly || query !== "";
  return (
    <>
      {showFilters && (
        <div class="filters">
          <div class="search">
            <Icon name="search" size={16} />
            <input type="search" placeholder="Filter servers" aria-label="Filter servers" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
          </div>
          {attention > 0 && (
            <button class="chip" aria-pressed={attentionOnly} onClick={() => setAttentionOnly(!attentionOnly)}>Needs attention <span class="count">{attention}</span></button>
          )}
        </div>
      )}
      <div class="panel">
        {shown.length ? (
          shown.map((s) => <ServerRow key={s.name} server={s} onChange={props.onChange} onTools={setToolsFor} />)
        ) : (
          <div class="empty"><p>No servers match.</p><button class="btn" onClick={() => { setQuery(""); setAttentionOnly(false); }}>Clear filters</button></div>
        )}
      </div>
      {toolsFor && <ToolsModal server={toolsFor} onClose={() => setToolsFor(null)} onChange={props.onChange} />}
    </>
  );
}
