import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";

/** True when an executable called `name` sits in one of the PATH directories. */
export function isOnPath(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  canExecute: (file: string) => boolean = defaultCanExecute,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const dirs = (env.PATH ?? env.Path ?? "").split(delimiter).filter(Boolean);
  const exts = platform === "win32" ? ["", ".cmd", ".exe", ".bat"] : [""];
  return dirs.some((d) => exts.some((e) => canExecute(join(d, name + e))));
}

function defaultCanExecute(file: string): boolean {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
