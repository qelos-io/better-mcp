import { useState } from "preact/hooks";
import type { ServerView } from "../../../src/manage/api-types";
import { api, serverPath } from "../api";
import { explainError } from "../lib/errors";
import { loginNotice, statusLabel } from "../lib/format";
import { toast, toastError } from "../toast";
import { Icon } from "./Icon";
import { Menu } from "./Menu";

function ActionButton(props: { label: string; run: () => Promise<unknown>; onDone: () => void; class?: string }) {
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

export function ServerRow(props: { server: ServerView; onChange: () => void; onTools: (name: string) => void }) {
  const { server: s, onChange } = props;
  const post = (sub: string) => () => api(serverPath(s.name, sub), "POST");
  const help = s.error ? explainError(s.error, s.transport) : null;
  const http = s.transport === "http";
  const loginPrimary = s.status === "needs_auth" || (s.status === "error" && help?.action === "login");
  const reconnectPrimary = s.status === "error" && !loginPrimary;
  const canLogin = http && s.status !== "connected" && s.status !== "disabled" && s.status !== "authenticating";

  const remove = async () => {
    if (!confirm(`Remove ${s.name}? Its configuration is deleted from your config file.`)) return;
    try {
      await api(serverPath(s.name), "DELETE");
      toast(`Removed ${s.name}.`);
    } catch (e) {
      toastError(e);
    }
    onChange();
  };
  const act = async (sub: string) => {
    try {
      await post(sub)();
    } catch (e) {
      toastError(e);
    }
    onChange();
  };

  return (
    <div class={"server " + s.status}>
      <div class="ident">
        <div class="title">
          <span class="name">{s.name}</span>
          <span class="status"><span class="dot" aria-hidden="true" />{statusLabel(s)}</span>
        </div>
        <div class="target">{s.target}</div>
      </div>
      <div class="controls">
        {s.status === "connected" && s.toolsTotal > 0 && (
          <button class="btn tools-btn" onClick={() => props.onTools(s.name)}>
            <Icon name="tools" size={15} />
            {s.tools === s.toolsTotal ? `${s.tools} tools` : `${s.tools} of ${s.toolsTotal} tools`}
          </button>
        )}
        {s.status === "authenticating" && s.loginUrl ? (
          <a class="btn primary" href={s.loginUrl} target="_blank" rel="noopener">Open login page <Icon name="external" size={14} /></a>
        ) : (
          canLogin && <ActionButton label="Log in" class={loginPrimary ? "primary" : ""} run={post("login")} onDone={onChange} />
        )}
        {reconnectPrimary && <ActionButton label="Reconnect" class="primary" run={post("reconnect")} onDone={onChange} />}
        <Menu
          label={`More actions for ${s.name}`}
          items={[
            ...(s.status === "connected" || s.status === "error" ? [{ label: "Reconnect", onSelect: () => void act("reconnect") }] : []),
            ...(s.status === "disabled"
              ? [{ label: "Enable", onSelect: () => void act("enable") }]
              : [{ label: "Disable", onSelect: () => void act("disable") }]),
            { label: "Remove…", danger: true, onSelect: () => void remove() },
          ]}
        />
      </div>
      {s.status === "authenticating" && <div class="notice">{loginNotice(s)}</div>}
      {s.error && <ErrorBox message={s.error} hint={help?.hint} />}
    </div>
  );
}

function ErrorBox({ message, hint }: { message: string; hint?: string }) {
  const [open, setOpen] = useState(!hint);
  return (
    <div class="err" role="group" aria-label="Connection problem">
      <Icon name="alert" size={16} />
      <div>
        {hint && <div class="hint">{hint}</div>}
        {(open || !hint) && <div class="msg">{message}</div>}
        {hint && <button type="button" class="link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide technical details" : "Technical details"}</button>}
      </div>
    </div>
  );
}
