import { useEffect, useState } from "preact/hooks";
import type { InstallInfo } from "../../../src/manage/api-types";
import { api } from "../api";
import { GLOBAL_INSTALL_CMD } from "../lib/cli-page";
import { clientGuides } from "../lib/install";
import { toast, toastError } from "../toast";
import { Icon } from "./Icon";

export function InstallPage() {
  const [info, setInfo] = useState<InstallInfo | null>(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState("claude-code");

  useEffect(() => {
    api<InstallInfo>("install").then(setInfo, (e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) return <div class="banner bad" role="alert">{error}</div>;
  if (!info) return <p class="muted">Loading…</p>;

  const guides = clientGuides(info);
  const guide = guides.find((g) => g.id === picked) ?? guides[0];
  const copy = () => navigator.clipboard.writeText(guide.snippet).then(() => toast("Copied."), toastError);

  return (
    <div class="install">
      {!info.globalInstalled && (
        <section class="pane">
          <header>
            <div>
              <h3>Install better-mcp globally</h3>
              <p class="muted">Do this once so <code>better-mcp</code> is available in your terminal and the Command line page uses it instead of <code>npx</code>. Reload this page after installing.</p>
            </div>
            <div class="pane-tools">
              <button class="btn" onClick={() => navigator.clipboard.writeText(GLOBAL_INSTALL_CMD).then(() => toast("Copied."), toastError)}><Icon name="copy" size={15} /> Copy</button>
            </div>
          </header>
          <div class="pane-body"><pre>{GLOBAL_INSTALL_CMD}</pre></div>
        </section>
      )}
      {!info.configPath && <div class="banner">This config was supplied inline, so the snippets have no <code>--config</code> path. Save it to a file to share it across clients.</div>}
      <div class="chips" role="group" aria-label="MCP client">
        {guides.map((g) => (
          <button class="chip" aria-pressed={g.id === guide.id} onClick={() => setPicked(g.id)} key={g.id}>{g.label}</button>
        ))}
      </div>
      <section class="pane">
        <header>
          <div>
            <h3>{guide.label}</h3>
            <p class="muted">{guide.steps}</p>
          </div>
          <div class="pane-tools">
            {guide.link && <a class="btn primary" href={guide.link}>Install in {guide.label}</a>}
            <button class="btn" onClick={copy}><Icon name="copy" size={15} /> Copy</button>
          </div>
        </header>
        <div class="pane-body"><pre>{guide.snippet}</pre></div>
      </section>
      {info.configPath && <p class="muted">Config: <code>{info.configPath}</code></p>}
    </div>
  );
}
