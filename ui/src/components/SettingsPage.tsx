import { useEffect, useState } from "preact/hooks";
import { RESTART_NOTE, SECTIONS, type Field, type Section } from "../../../src/manage/settings-schema";
import { api } from "../api";
import { defaultDraft, diffPatch, initDrafts, isDefaultDraft, listToText, parseNumber, textToList, type Drafts } from "../lib/settings-draft";
import { toast, toastError } from "../toast";

interface Loaded {
  values: Record<string, unknown>;
  writable: boolean;
  restartRequired: boolean;
}

function FieldInput(props: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const { field: f, value } = props;
  const id = `f-${f.key}-${Math.random().toString(36).slice(2, 7)}`;
  const inputType = f.type === "number" ? "number" : "text";
  if (f.type === "boolean") {
    return (
      <label class="check">
        <input type="checkbox" checked={typeof value === "boolean" ? value : f.default === true} onChange={(e) => props.onChange(e.currentTarget.checked)} />
        <span>{f.label}</span>
        {f.help && <small class="muted">{f.help}</small>}
      </label>
    );
  }
  return (
    <div class="field">
      <label for={id}>{f.label}</label>
      {f.type === "string-list" ? (
        <textarea id={id} class="short" spellcheck={false} placeholder={f.placeholder} value={listToText(value)} onInput={(e) => props.onChange(textToList(e.currentTarget.value))} />
      ) : f.type === "select" ? (
        <select id={id} value={String(value ?? f.default ?? "")} onChange={(e) => props.onChange(e.currentTarget.value)}>
          {f.options?.map((o) => <option value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          id={id}
          {...({ type: inputType } as { type: "text" })}
          min={f.min}
          value={value === undefined ? "" : String(value)}
          placeholder={f.placeholder ?? (f.default !== undefined ? String(f.default) : "")}
          onInput={(e) => props.onChange(f.type === "number" ? parseNumber(e.currentTarget.value) : e.currentTarget.value)}
        />
      )}
      {f.help && <small class="muted">{f.help}</small>}
    </div>
  );
}

function SectionBlock(props: { section: Section; draft: Drafts[string]; disabled: boolean; edited: boolean; onChange: (d: Drafts[string]) => void }) {
  const { section: s, draft } = props;
  const setValue = (key: string, v: unknown) => props.onChange({ ...draft, values: { ...draft.values, [key]: v } });
  return (
    <div class="setting">
      <div class="setting-head">
        <div>
          <div class="name">
            {s.title}
            {props.edited && <span class="edited">Edited</span>}
          </div>
          <p class="muted">{s.summary}</p>
          {!props.disabled && !isDefaultDraft(s, draft) && (
            <button type="button" class="link" onClick={() => props.onChange(defaultDraft(s))}>Reset to defaults</button>
          )}
        </div>
        {s.kind !== "list" && (
          <label class="switch">
            <input type="checkbox" role="switch" aria-label={`Enable ${s.title}`} checked={draft.enabled} disabled={props.disabled} onChange={(e) => props.onChange({ ...draft, enabled: e.currentTarget.checked })} />
            <span class="track" />
          </label>
        )}
      </div>
      {s.kind !== "flag" && (draft.enabled || s.kind === "list") && (
        <fieldset class="options" disabled={props.disabled}>
          {([s.fields.filter((f) => f.type === "boolean"), s.fields.filter((f) => f.type !== "boolean")] as const).map(
            (fields, i) =>
              fields.length > 0 && (
                <div class={i === 0 ? "checks" : "fields"} key={i}>
                  {fields.map((f) => (
                    <FieldInput key={f.key} field={f} value={draft.values[f.key]} onChange={(v) => setValue(f.key, v)} />
                  ))}
                </div>
              ),
          )}
        </fieldset>
      )}
    </div>
  );
}

export function SettingsPage({ onSaved }: { onSaved: () => void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const next = await api<Loaded>("settings");
      setLoaded(next);
      setDrafts(initDrafts(next.values));
    } catch (e) {
      toastError(e);
    }
  };
  useEffect(() => void load(), []);

  const patch = loaded ? diffPatch(loaded.values, drafts) : {};
  const dirty = Object.keys(patch).length > 0;

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const res = await api<{ applied: boolean; error?: string }>("settings", "POST", { patch });
      toast(res.applied ? "Saved and applied." : res.error ? `Saved, but not applied: ${res.error}` : "Saved.");
      await load();
      onSaved();
    } catch (e) {
      toastError(e);
    }
    setSaving(false);
  };

  useEffect(() => {
    if (!dirty) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  });

  if (!loaded) return <p class="muted" aria-busy="true">Loading settings…</p>;

  const groups = [...new Set(SECTIONS.map((s) => s.group))];
  return (
    <section>
      {loaded.restartRequired && <div class="banner" role="status">{RESTART_NOTE}</div>}
      {!loaded.writable && <div class="banner">This config was supplied inline, so settings are read-only.</div>}
      {groups.map((g) => (
        <div class="group" key={g}>
          <h2>{g}</h2>
          <div class="list">
            {SECTIONS.filter((s) => s.group === g).map((s) => (
              <SectionBlock key={s.id} section={s} draft={drafts[s.id]} disabled={!loaded.writable} edited={s.id in patch} onChange={(d) => setDrafts({ ...drafts, [s.id]: d })} />
            ))}
          </div>
        </div>
      ))}
      {dirty && (
        <div class="savebar" role="region" aria-label="Unsaved changes">
          <span>{Object.keys(patch).length} unsaved {Object.keys(patch).length === 1 ? "change" : "changes"}</span>
          <button class="btn" onClick={() => setDrafts(initDrafts(loaded.values))}>Discard</button>
          <button class="btn primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}<kbd>⌘S</kbd></button>
        </div>
      )}
    </section>
  );
}
