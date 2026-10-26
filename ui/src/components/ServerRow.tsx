import { useEffect, useState } from "preact/hooks";
import type { ServerView } from "../../../src/manage/api-types";
import { api, serverPath } from "../api";
import { loginNotice, stateLabel } from "../lib/format";
import { toast } from "../toast";
import { ToolsPanel } from "./ToolsPanel";

function ActionButton(props: { label: string; run: () => Promise<unknown>; onDone: () => void; class?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      class={"btn " + (props.class ?? "")}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await props.run();
        } catch (e) {
          toast((e as Error).message);
        }
        setBusy(false);
        props.onDone();
      }}
    >
      {props.label}
    </button>
  );
}

export function ServerRow({ server: s, onChange }: { server: ServerView; onChange: () => void }) {
  const [armed, setArmed] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const post = (sub: string) => () => api(serverPath(s.name, sub), "POST");
  const canLogin = s.transport === "http" && s.status !== "connected" && s.status !== "disabled";

  return (
    <div class={"row " + s.status}>
      <span class="dot" aria-hidden="true" />
      <div class="main">
        <div class="title">
          <span class="name">{s.name}</span>
          <span class="state">{stateLabel(s)}</span>
        </div>
        <div class="target">{s.target}</div>
      </div>
      <div class="actions">
        {s.status === "authenticating" && s.loginUrl ? (
          <a class="btn primary" href={s.loginUrl} target="_blank" rel="noopener">Open login page</a>
        ) : (
          canLogin && s.status !== "authenticating" && <ActionButton label="Log in" class="primary" run={post("login")} onDone={onChange} />
        )}
        {s.status === "connected" && s.toolsTotal > 0 && (
          <button class="btn ghost" aria-expanded={toolsOpen} onClick={() => setToolsOpen(!toolsOpen)}>
            {toolsOpen ? "Hide tools" : "Tools"}
          </button>
        )}
        {(s.status === "connected" || s.status === "error") && (
          <ActionButton label="Reconnect" class="ghost" run={post("reconnect")} onDone={onChange} />
        )}
        <ActionButton
          label={s.status === "disabled" ? "Enable" : "Disable"}
          class="ghost"
          run={post(s.status === "disabled" ? "enable" : "disable")}
          onDone={onChange}
        />
        <button
          class={"btn ghost danger" + (armed ? " armed" : "")}
          onClick={async () => {
            if (!armed) return setArmed(true);
            setArmed(false);
            try {
              await api(serverPath(s.name), "DELETE");
            } catch (e) {
              toast((e as Error).message);
            }
            onChange();
          }}
        >
          {armed ? "Confirm remove" : "Remove"}
        </button>
      </div>
      {s.status === "authenticating" && <div class="notice">{loginNotice(s)}</div>}
      {s.status === "connected" && toolsOpen && <ToolsPanel server={s.name} onChange={onChange} />}
      {s.error && <ErrorBox message={s.error} />}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div class={"err" + (open ? " open" : "")}>
      <div class="msg">{message}</div>
      {message.length > 110 && (
        <button type="button" onClick={() => setOpen(!open)}>{open ? "Hide details" : "Show details"}</button>
      )}
    </div>
  );
}
