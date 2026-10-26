import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { RunToolResult, ToolDetail } from "../../../src/manage/api-types";
import { api, serverPath } from "../api";
import { byteSize, formatBytes, reduction, viewResult } from "../lib/result";
import { buildArgs, fieldsFromSchema, initialValues, type FieldValues, type SchemaField } from "../lib/schema-form";
import { toast, toastError } from "../toast";
import { Icon } from "./Icon";

function FieldRow(props: { field: SchemaField; value: string | boolean; error?: string; onChange: (v: string | boolean) => void }) {
  const { field: f, value, error } = props;
  const id = "arg-" + f.name;
  const label = (
    <label for={id}>
      <span class="tn">{f.name}</span>
      {f.required && <span class="req" title="Required"> *</span>}
      <span class="kind">{f.kind === "enum" ? "choice" : f.kind}</span>
    </label>
  );
  return (
    <div class={"arg" + (error ? " invalid" : "")}>
      {label}
      {f.kind === "boolean" ? (
        <label class="check"><input id={id} type="checkbox" checked={value === true} onChange={(e) => props.onChange(e.currentTarget.checked)} /><span>{value === true ? "true" : "false"}</span></label>
      ) : f.kind === "enum" ? (
        <select id={id} value={String(value)} onChange={(e) => props.onChange(e.currentTarget.value)}>
          <option value="">{f.required ? "Choose…" : "Not set"}</option>
          {f.options?.map((o) => <option value={o}>{o}</option>)}
        </select>
      ) : f.kind === "json" ? (
        <textarea id={id} class="short" spellcheck={false} placeholder="JSON" value={String(value)} onInput={(e) => props.onChange(e.currentTarget.value)} />
      ) : (
        <input id={id} type="text" inputMode={f.kind === "string" ? undefined : "decimal"} spellcheck={false} value={String(value)} onInput={(e) => props.onChange(e.currentTarget.value)} />
      )}
      {error ? <small class="field-error">{error}</small> : f.description && <small class="muted">{f.description}</small>}
    </div>
  );
}

function Pane(props: { title: string; note: string; value: unknown; empty?: string }) {
  const [json, setJson] = useState(false);
  const view = useMemo(() => viewResult(props.value), [props.value]);
  const text = json || !view.blocks.length ? JSON.stringify(props.value, null, 2) : "";
  return (
    <section class="pane">
      <header>
        <div>
          <h3>{props.title}</h3>
          <p class="muted small">{props.note}</p>
        </div>
        {props.value !== undefined && (
          <div class="pane-tools">
            <button class="link" onClick={() => setJson(!json)}>{json ? "Show readable" : "Show JSON"}</button>
            <button class="icon-btn small-btn" aria-label={`Copy ${props.title}`} onClick={() => navigator.clipboard.writeText(JSON.stringify(props.value, null, 2)).then(() => toast("Copied."), toastError)}><Icon name="copy" size={15} /></button>
          </div>
        )}
      </header>
      {props.value === undefined ? (
        <p class="muted pane-empty">{props.empty ?? "Nothing returned."}</p>
      ) : (
        <div class="pane-body">
          {view.isError && <div class="flag">The tool reported an error</div>}
          {text ? <pre>{text}</pre> : view.blocks.map((b) => (b.kind === "text" ? <pre>{b.text}</pre> : <p class="other-block">{b.label}</p>))}
        </div>
      )}
    </section>
  );
}

export function ToolRunner({ server, tool, onBack }: { server: string; tool: string; onBack: () => void }) {
  const [detail, setDetail] = useState<ToolDetail | null>(null);
  const [mode, setMode] = useState<"form" | "json">("form");
  const [values, setValues] = useState<FieldValues>({});
  const [jsonText, setJsonText] = useState("{}");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunToolResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [result]);

  const fields = useMemo(() => (detail ? fieldsFromSchema(detail.inputSchema) : null), [detail]);

  useEffect(() => {
    api<ToolDetail>(serverPath(server, `tools/${encodeURIComponent(tool)}`)).then(
      (d) => {
        setDetail(d);
        const f = fieldsFromSchema(d.inputSchema);
        if (f) setValues(initialValues(f));
        else setMode("json");
      },
      (e) => {
        toastError(e);
        onBack();
      },
    );
  }, [server, tool]);

  const run = async () => {
    if (!detail || running) return;
    let args: Record<string, unknown>;
    if (mode === "form" && fields) {
      const built = buildArgs(fields, values);
      setErrors(built.errors);
      if (Object.keys(built.errors).length) return;
      args = built.args;
    } else {
      try {
        const parsed = JSON.parse(jsonText || "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Arguments must be a JSON object.");
        args = parsed;
        setErrors({});
      } catch (e) {
        return setErrors({ __json: (e as Error).message });
      }
    }
    if (detail.annotations?.destructiveHint === true && !confirm(`${tool} is marked destructive. Run it for real?`)) return;
    setRunning(true);
    setResult(null);
    try {
      setResult(await api<RunToolResult>(serverPath(server, `tools/${encodeURIComponent(tool)}/call`), "POST", { arguments: args }));
    } catch (e) {
      toastError(e);
    }
    setRunning(false);
  };

  const switchMode = (next: "form" | "json") => {
    if (next === mode) return;
    if (next === "json" && fields) setJsonText(JSON.stringify(buildArgs(fields, values).args, null, 2));
    setErrors({});
    setMode(next);
  };

  const rawBytes = byteSize(result?.raw);
  const outBytes = byteSize(result?.processed);
  const ann = detail?.annotations ?? {};

  return (
    <div class="runner" onKeyDown={(e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void run(); } }}>
      <div class="runner-head">
        <button class="btn" onClick={onBack}><Icon name="back" size={15} /> All tools</button>
        <div class="runner-title">
          <span class="tn big">{tool}</span>
          {ann.readOnlyHint === true && <span class="pill ok">Read-only</span>}
          {ann.destructiveHint === true && <span class="pill bad">Destructive</span>}
        </div>
      </div>
      {!detail ? (
        <div aria-busy="true"><div class="bone w70" /><div class="bone w40" /></div>
      ) : (
        <>
          {detail.description && <p class="runner-desc">{detail.description}</p>}
          <div class="args">
            <div class="args-head">
              <h3>Arguments</h3>
              {fields && (
                <div class="segmented" role="group" aria-label="Argument editor">
                  <button class="seg" aria-pressed={mode === "form"} onClick={() => switchMode("form")}>Form</button>
                  <button class="seg" aria-pressed={mode === "json"} onClick={() => switchMode("json")}>JSON</button>
                </div>
              )}
            </div>
            {mode === "form" && fields ? (
              <div class="arg-grid">
                {fields.map((f) => <FieldRow key={f.name} field={f} value={values[f.name] ?? ""} error={errors[f.name]} onChange={(v) => setValues({ ...values, [f.name]: v })} />)}
              </div>
            ) : (
              <div class={"arg" + (errors.__json ? " invalid" : "")}>
                {!fields && <p class="muted small">This tool takes no arguments, or its schema is too free-form for a form. Enter them as JSON.</p>}
                <textarea aria-label="Arguments as JSON" spellcheck={false} value={jsonText} onInput={(e) => setJsonText(e.currentTarget.value)} />
                {errors.__json && <small class="field-error">{errors.__json}</small>}
              </div>
            )}
            <div class="run-bar">
              <button class="btn primary" disabled={running} onClick={run}>
                <Icon name="play" size={14} /> {running ? "Running…" : "Run tool"} {!running && <kbd>⌘↵</kbd>}
              </button>
              <span class="muted small">Runs the tool for real, with your credentials, through the same middleware your client uses.</span>
            </div>
          </div>
          {running && <div class="running" aria-busy="true"><div class="bone w70" /><div class="bone w40" /></div>}
          {result && (
            <div class="result" aria-live="polite" ref={resultRef}>
              {result.error && <div class="error-summary" role="alert"><strong>The call failed</strong><p>{result.error}</p></div>}
              <div class="result-summary">
                <span>Finished in {result.durationMs} ms</span>
                {result.raw !== undefined && result.processed !== undefined && (
                  <span>
                    {formatBytes(rawBytes)} → {formatBytes(outBytes)} <strong class={rawBytes === outBytes ? "" : outBytes < rawBytes ? "good" : "warn"}>({reduction(rawBytes, outBytes)})</strong>
                  </span>
                )}
                {!result.error && <span class={"pill " + (result.changed ? "info" : "")}>{result.changed ? "Changed by better-mcp" : "Passed through unchanged"}</span>}
              </div>
              <div class="compare">
                <Pane title="Tool response" note="Exactly what the server returned." value={result.raw} empty={result.error ? "The call failed before a response." : undefined} />
                <Pane title="Delivered to the client" note="After better-mcp's middleware (redact, compact, offload…)." value={result.processed} empty={result.error ? "Nothing was delivered." : undefined} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
