import { useEffect, useState } from "preact/hooks";
import type { ServerView } from "../../../src/manage/api-types";
import { api, serverPath } from "../api";
import { explainError } from "../lib/errors";
import { loginNotice, stateLabel } from "../lib/format";
import { toast, toastError } from "../toast";
import { ToolsPanel } from "./ToolsPanel";

function ActionButton(props: { label: string; run: () => Promise<unknown>; onDone: () => void; class?: string; done?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      class={"btn " + (props.class ?? "")}
      disabled={busy}
      aria-busy={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await props.run();
          if (props.done) toast(props.done);
        } catch (e) {
          toastError(e);
        }
        setBusy(false);
        props.onDone();
      }}
    >
      {busy ? "Working…" : props.label}
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
  const help = s.error ? explainError(s.error, s.transport) : null;
  const http = s.transport === "http";
  const loginPrimary = s.status === "needs_auth" || (s.status === "error" && help?.action === "login");
  const reconnectPrimary = s.status === "error" && !loginPrimary;
  const canLogin = http && s.status !== "connected" && s.status !== "disabled" && s.status !== "authenticating";

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
          canLogin && <ActionButton label="Log in" class={loginPrimary ? "primary" : "ghost"} run={post("login")} onDone={onChange} />
        )}
        {s.status === "connected" && s.toolsTotal > 0 && (
          <button class="btn ghost" aria-expanded={toolsOpen} onClick={() => setToolsOpen(!toolsOpen)}>
            {toolsOpen ? "Hide tools" : "Tools"}
          </button>
        )}
        {(s.status === "connected" || s.status === "error") && (
          <ActionButton label="Reconnect" class={reconnectPrimary ? "primary" : "ghost"} run={post("reconnect")} onDone={onChange} />
        )}
        <ActionButton
          label={s.status === "disabled" ? "Enable" : "Disable"}
          class="ghost"
          run={post(s.status === "disabled" ? "enable" : "disable")}
          onDone={onChange}
        />
        <button
          class={"btn ghost danger" + (armed ? " armed" : "")}
          aria-label={armed ? `Confirm removing ${s.name}` : `Remove ${s.name}`}
          onClick={async () => {
            if (!armed) return setArmed(true);
            setArmed(false);
            try {
              await api(serverPath(s.name), "DELETE");
              toast(`Removed ${s.name}.`);
            } catch (e) {
              toastError(e);
            }
            onChange();
          }}
        >
          {armed ? "Confirm remove" : "Remove"}
        </button>
      </div>
      {s.status === "authenticating" && <div class="notice">{loginNotice(s)}</div>}
      {s.status === "connected" && toolsOpen && <ToolsPanel server={s.name} onChange={onChange} />}
      {s.error && <ErrorBox message={s.error} hint={help?.hint} />}
    </div>
  );
}

function ErrorBox({ message, hint }: { message: string; hint?: string }) {
  const [open, setOpen] = useState(!hint);
  return (
    <div class={"err" + (open ? " open" : "")} role="group" aria-label="Connection problem">
      {hint && <div class="hint">{hint}</div>}
      {(open || !hint) && <div class="msg">{message}</div>}
      {hint && (
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide technical details" : "Technical details"}</button>
      )}
    </div>
  );
}
