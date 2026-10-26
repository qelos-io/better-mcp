import { useEffect, useRef, useState } from "preact/hooks";
import { Icon } from "./Icon";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    root.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      root.current?.querySelector<HTMLElement>(".menu-btn")?.focus();
      return;
    }
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!step || !open) return;
    e.preventDefault();
    const els = [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
    const at = els.indexOf(document.activeElement as HTMLElement);
    els[(at + step + els.length) % els.length]?.focus();
  };

  return (
    <div class="menu" ref={root} onKeyDown={onKey}>
      <button class="icon-btn menu-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="more" />
      </button>
      {open && (
        <div class="menu-pop" role="menu" aria-label={label}>
          {items.map((it) => (
            <button
              role="menuitem"
              class={"menu-item" + (it.danger ? " danger" : "")}
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              key={it.label}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
