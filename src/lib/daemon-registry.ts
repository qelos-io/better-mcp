import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** A running better-mcp process whose management API other commands can reuse. */
export interface DaemonEntry {
  pid: number;
  /** Management URL including its secret token path. */
  url: string;
  configPath: string;
  configMtimeMs: number;
  version: string;
  /** "daemon" is the background helper started by `tools`; "app" is a user-run `better-mcp app`. */
  kind: "daemon" | "app";
}

export function daemonDir(env: NodeJS.ProcessEnv = process.env): string {
  return join(env.BETTER_MCP_HOME || join(homedir(), ".better-mcp"), "daemons");
}

export function entryFile(dir: string, configPath: string): string {
  return join(dir, createHash("sha256").update(configPath).digest("hex").slice(0, 16) + ".json");
}

export function parseEntry(text: string): DaemonEntry | undefined {
  try {
    const e = JSON.parse(text) as Partial<DaemonEntry>;
    const ok =
      Number.isInteger(e.pid) && typeof e.url === "string" && typeof e.configPath === "string" &&
      typeof e.configMtimeMs === "number" && typeof e.version === "string" && (e.kind === "daemon" || e.kind === "app");
    return ok ? (e as DaemonEntry) : undefined;
  } catch {
    return undefined;
  }
}

export async function readEntry(file: string): Promise<DaemonEntry | undefined> {
  try {
    return parseEntry(await readFile(file, "utf8"));
  } catch {
    return undefined;
  }
}

/** The file holds a secret URL, so it is private to the user. */
export async function writeEntry(file: string, entry: DaemonEntry): Promise<void> {
  await mkdir(join(file, ".."), { recursive: true, mode: 0o700 });
  await writeFile(file, JSON.stringify(entry), { mode: 0o600 });
}

export async function removeEntry(file: string, onlyPid?: number): Promise<void> {
  if (onlyPid !== undefined && (await readEntry(file))?.pid !== onlyPid) return;
  await rm(file, { force: true });
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}
