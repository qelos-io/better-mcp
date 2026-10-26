import { dismissToast, useToasts } from "../toast";

export function Toasts() {
  const items = useToasts();
  return (
    <div class="toasts" aria-live="polite">
      {items.map((t) => (
        <div class={"toast " + t.kind} role={t.kind === "error" ? "alert" : "status"} key={t.id}>
          <span>{t.text}</span>
          <button type="button" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
