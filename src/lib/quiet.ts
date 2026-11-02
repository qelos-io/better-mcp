let quiet = false;

/** True while diagnostics are suppressed (`tools` commands without --verbose). */
export const isQuiet = (): boolean => quiet;

/**
 * Swallow everything written to stderr, including `console.warn` from libraries,
 * so a command's stdout stays clean. Returns a writer that still reaches the
 * real stderr (for the command's own errors) and a function that undoes it.
 */
export function silenceStderr(stream: { write: (...a: any[]) => boolean } = process.stderr): {
  write: (text: string) => void;
  restore: () => void;
} {
  const original = stream.write;
  quiet = true;
  stream.write = ((_chunk: unknown, ...rest: unknown[]) => {
    const cb = rest.find((r) => typeof r === "function") as (() => void) | undefined;
    cb?.();
    return true;
  }) as typeof stream.write;
  return {
    write: (text) => void original.call(stream, text),
    restore: () => {
      quiet = false;
      stream.write = original;
    },
  };
}
