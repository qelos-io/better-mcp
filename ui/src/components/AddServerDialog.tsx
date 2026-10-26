import { useEffect, useRef, useState } from "preact/hooks";
import type { McpServerConfig } from "../../../src/types/index";
import { api } from "../api";
import { buildConfig, emptyForm, formFromConfig, validateName, type FormErrors, type ServerForm, type ServerKind } from "../lib/server-form";

export interface InstallRequest {
  name: string;
  config: McpServerConfig | null;
  title: string;
  setup: string;
}

type Mode = ServerKind | "json";
const MODE_LABEL: Record<Mode, string> = { local: "Local command", remote: "Remote URL", json: "JSON" };

function Field(props: { id: string; label: string; error?: string; help?: string; children: preact.ComponentChildren }) {
  return (
    <div class={"field" + (props.error ? " invalid" : "")}>
      <label for={props.id}>{props.label}</label>
      {props.children}
      {props.error ? <small class="field-error" id={props.id + "-err"}>{props.error}</small> : props.help && <small class="muted">{props.help}</small>}
    </div>
  );
}

export function AddServerDialog(props: { request: InstallRequest; existing: string[]; onClose: () => void; onInstalled: () => void }) {
  const { request } = props;
  const ref = useRef<HTMLDialogElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<ServerForm>(() => (request.config ? formFromConfig(request.name, request.config) : { ...emptyForm(), name: request.name }));
  const [mode, setMode] = useState<Mode>(form.kind);
  const [json, setJson] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => void ref.current?.showModal(), []);
  const set = (patch: Partial<ServerForm>) => setForm((f) => ({ ...f, ...patch }));
  const showErrors = (e: FormErrors, extra = "") => {
    setErrors(e);
    setServerError(extra);
    queueMicrotask(() => summary.current?.focus());
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    if (next === "json") {
      const built = buildConfig(form);
      setJson(JSON.stringify(built.config ?? {}, null, 2));
    } else if (mode === "json") {
      try {
        set({ ...formFromConfig(form.name, JSON.parse(json)), kind: next });
      } catch {
        return showErrors({}, "The JSON isn't valid yet, so it can't be shown as a form. Fix it or keep editing here.");
      }
    } else {
      set({ kind: next });
    }
    setErrors({});
    setServerError("");
    setMode(next);
  };

  const submit = async (ev: Event) => {
    ev.preventDefault();
    const nameError = validateName(form.name, props.existing);
    let config: McpServerConfig | undefined;
    const errs: FormErrors = {};
    if (nameError) errs.name = nameError;
    if (mode === "json") {
      try {
        config = JSON.parse(json);
      } catch (e) {
        return showErrors(errs, `The JSON isn't valid: ${(e as Error).message}`);
      }
    } else {
      const built = buildConfig({ ...form, kind: mode });
      Object.assign(errs, built.errors);
      config = built.config;
    }
    if (Object.keys(errs).length || !config) return showErrors(errs);
    setBusy(true);
    try {
      await api("servers", "POST", { name: form.name.trim(), config });
      props.onInstalled();
      props.onClose();
    } catch (e) {
      setBusy(false);
      showErrors({}, (e as Error).message);
    }
  };

  const preview = mode === "json" ? null : buildConfig({ ...form, kind: mode }).config;
  const errorList = Object.entries(errors);
  return (
    <dialog ref={ref} onClose={props.onClose} aria-labelledby="dtitle">
      <form onSubmit={submit} noValidate>
        <h2 id="dtitle">{request.title}</h2>
        {request.setup && <p class="muted">Setup: {request.setup}</p>}
        {(errorList.length > 0 || serverError) && (
          <div class="error-summary" role="alert" tabIndex={-1} ref={summary}>
            <strong>{serverError ? "Couldn't add the server" : "Fix these to continue"}</strong>
            {serverError && <p>{serverError}</p>}
            {errorList.length > 0 && (
              <ul>{errorList.map(([k, m]) => <li key={k}><a href={"#d-" + k} onClick={(e) => { e.preventDefault(); document.getElementById("d-" + k)?.focus(); }}>{m}</a></li>)}</ul>
            )}
          </div>
        )}
        <Field id="d-name" label="Name" error={errors.name} help="Shown in tool names, for example github__search.">
          <input id="d-name" autoFocus={!form.name} value={form.name} aria-invalid={!!errors.name} aria-describedby={errors.name ? "d-name-err" : undefined} autocomplete="off" spellcheck={false}
            onInput={(e) => set({ name: e.currentTarget.value })}
            onBlur={() => form.name && setErrors((x) => ({ ...x, name: validateName(form.name, props.existing) ?? undefined }))} />
        </Field>
        <div class="segmented" role="tablist" aria-label="How to connect">
          {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
            <button type="button" role="tab" aria-selected={mode === m} class="tab" onClick={() => switchMode(m)} key={m}>{MODE_LABEL[m]}</button>
          ))}
        </div>
        {mode === "local" && (
          <>
            <Field id="d-command" label="Command" error={errors.command} help="The program that starts the server.">
              <input id="d-command" value={form.command} placeholder="npx" aria-invalid={!!errors.command} spellcheck={false} onInput={(e) => set({ command: e.currentTarget.value })} />
            </Field>
            <Field id="d-args" label="Arguments" help="One per line.">
              <textarea id="d-args" class="short" spellcheck={false} value={form.args} placeholder={"-y\n@modelcontextprotocol/server-filesystem"} onInput={(e) => set({ args: e.currentTarget.value })} />
            </Field>
            <Field id="d-env" label="Environment variables" error={errors.env} help="One KEY=value per line. ${VAR} reads from your environment.">
              <textarea id="d-env" class="short" spellcheck={false} value={form.env} aria-invalid={!!errors.env} onInput={(e) => set({ env: e.currentTarget.value })} />
            </Field>
          </>
        )}
        {mode === "remote" && (
          <>
            <Field id="d-url" label="Server URL" error={errors.url} help="Servers that need a login open a browser window for it.">
              <input id="d-url" type="url" value={form.url} placeholder="https://example.com/mcp" aria-invalid={!!errors.url} spellcheck={false} onInput={(e) => set({ url: e.currentTarget.value })} />
            </Field>
            <Field id="d-headers" label="Headers" error={errors.headers} help="Optional, one Name: value per line, for example an API key.">
              <textarea id="d-headers" class="short" spellcheck={false} value={form.headers} aria-invalid={!!errors.headers} onInput={(e) => set({ headers: e.currentTarget.value })} />
            </Field>
          </>
        )}
        {mode === "json" && (
          <Field id="d-json" label="Config (JSON, same shape as an mcpServers entry)">
            <textarea id="d-json" spellcheck={false} value={json} onInput={(e) => setJson(e.currentTarget.value)} />
          </Field>
        )}
        {preview && (
          <details class="preview">
            <summary>Config preview</summary>
            <pre>{JSON.stringify(preview, null, 2)}</pre>
          </details>
        )}
        <div class="dialog-actions">
          <button class="btn" type="button" onClick={() => ref.current?.close()}>Cancel</button>
          <button class="btn primary" type="submit" disabled={busy}>{busy ? "Adding…" : "Add server"}</button>
        </div>
      </form>
    </dialog>
  );
}
