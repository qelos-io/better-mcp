import { useEffect, useState } from "preact/hooks";

export type ToastKind = "info" | "error";
export interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<(items: ToastItem[]) => void>();
const emit = () => listeners.forEach((l) => l(items));

export function dismissToast(id: number): void {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function toast(text: string, kind: ToastKind = "info"): void {
  const id = nextId++;
  items = [...items.slice(-2), { id, text, kind }];
  emit();
  setTimeout(() => dismissToast(id), kind === "error" ? 9000 : 4000);
}

export const toastError = (e: unknown): void => toast(e instanceof Error ? e.message : String(e), "error");

export function useToasts(): ToastItem[] {
  const [list, setList] = useState(items);
  useEffect(() => {
    listeners.add(setList);
    return () => void listeners.delete(setList);
  }, []);
  return list;
}
