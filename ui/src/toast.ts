import { useEffect, useState } from "preact/hooks";

type Listener = (msg: string) => void;
const listeners = new Set<Listener>();

export function toast(msg: string): void {
  for (const l of listeners) l(msg);
}

export function useToast(durationMs = 5000): string {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const l: Listener = (m) => {
      setMsg(m);
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(""), durationMs);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
      clearTimeout(timer);
    };
  }, [durationMs]);
  return msg;
}
