import type { ServerView } from "../../../src/manage/api-types";
import { summarize } from "../lib/format";
import { ServerRow } from "./ServerRow";

export function ServerList(props: { servers: ServerView[]; onChange: () => void; onAddCustom: () => void }) {
  const { servers } = props;
  return (
    <section>
      <div class="bar">
        <span class="summary" aria-live="polite">{summarize(servers)}</span>
        <button class="btn" onClick={props.onAddCustom}>Add custom server…</button>
      </div>
      <div class="list">
        {servers.length ? (
          servers.map((s) => <ServerRow key={s.name} server={s} onChange={props.onChange} />)
        ) : (
          <p class="empty">No servers yet. Install one from the Marketplace.</p>
        )}
      </div>
    </section>
  );
}
