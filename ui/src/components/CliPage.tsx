import { useEffect, useState } from "preact/hooks";
import type { InstallInfo } from "../../../src/manage/api-types";
import { TOOLS_COMMANDS, TOOLS_NAMING_NOTE } from "../../../src/lib/tools-docs";
import { api } from "../api";
import { withLaunch } from "../lib/cli-page";
import { toast, toastError } from "../toast";
import { Icon } from "./Icon";

export function CliPage() {
  const [info, setInfo] = useState<InstallInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<InstallInfo>("install").then(setInfo, (e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) return <div class="banner bad" role="alert">{error}</div>;
  if (!info) return <p class="muted">Loading…</p>;

  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast("Copied."), toastError);

  return (
    <div class="install cli">
      <p class="muted">Use the tools of every connected server from your shell or scripts. {TOOLS_NAMING_NOTE} Run <code>help tools</code> for this in the terminal.</p>
      {TOOLS_COMMANDS.map((c) => (
        <section class="pane" key={c.id}>
          <header>
            <div>
              <h3><code>tools {c.usage.replace("better-mcp tools ", "")}</code></h3>
              <p class="muted">{c.summary}</p>
            </div>
          </header>
          <div class="pane-body">
            {c.details.map((d) => <p class="muted" key={d}>{d}</p>)}
            {c.examples.map((e) => {
              const line = withLaunch(e.cmd, info);
              return (
                <div class="cli-example" key={e.cmd}>
                  <span class="muted">{e.note}</span>
                  <div class="cli-line">
                    <pre>{line}</pre>
                    <button class="btn" aria-label="Copy command" onClick={() => copy(line)}><Icon name="copy" size={15} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {!info.configPath && <p class="muted">This config was supplied inline, so the commands have no <code>--config</code> path.</p>}
    </div>
  );
}
