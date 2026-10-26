import { useEffect, useRef, useState } from "preact/hooks";
import type { McpServerConfig } from "../../../src/types/index";
import { api } from "../api";

export interface InstallRequest {
  name: string;
  config: McpServerConfig;
  title: string;
  setup: string;
}

export function InstallDialog(props: { request: InstallRequest; onClose: () => void; onInstalled: () => void }) {
  const { request } = props;
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(request.name);
  const [cfg, setCfg] = useState(JSON.stringify(request.config, null, 2));
  const [err, setErr] = useState("");

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const submit = async (ev: Event) => {
    ev.preventDefault();
    try {
      await api("servers", "POST", { name: name.trim(), config: JSON.parse(cfg) });
      props.onInstalled();
      props.onClose();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <dialog ref={ref} onClose={props.onClose}>
      <form onSubmit={submit}>
        <h2 style="margin-top:0">{request.title}</h2>
        {request.setup && <p class="muted">Setup: {request.setup}</p>}
        <div class="field">
          <label for="dname">Name</label>
          <input id="dname" required pattern="[A-Za-z0-9][A-Za-z0-9_\-]*" title="letters, digits, - and _" value={name} onInput={(e) => setName(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label for="dcfg">Config (JSON, same shape as an mcpServers entry)</label>
          <textarea id="dcfg" spellcheck={false} value={cfg} onInput={(e) => setCfg(e.currentTarget.value)} />
        </div>
        <p class="err">{err}</p>
        <div class="actions">
          <button class="btn primary" type="submit">Install</button>
          <button class="btn" type="button" onClick={() => ref.current?.close()}>Cancel</button>
        </div>
      </form>
    </dialog>
  );
}
