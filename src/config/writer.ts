import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import type { McpServerConfig } from "../types/index.js";

type Raw = Record<string, unknown>;

async function writeOnce(path: string, mutate: (raw: Raw) => void, renameImpl: typeof rename): Promise<void> {
  const raw = JSON.parse(await readFile(path, "utf8")) as Raw;
  mutate(raw);
  const text = JSON.stringify(raw, null, 2) + "\n";
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, text);
  try {
    await renameImpl(tmp, path);
  } catch {
    // A single-file bind mount (Docker `-v ./mcp.json:/app/mcp.json`) can't be
    // replaced by rename (EBUSY); overwrite in place instead.
    await unlink(tmp).catch(() => {});
    await writeFile(path, text);
  }
}

const queues = new Map<string, Promise<void>>();

/**
 * Read-modify-write the JSON config at `path`, leaving every key `mutate`
 * doesn't touch as it was. Writers to the same file are serialized so
 * concurrent updates (server edits + token refreshes) never clobber each other.
 */
export function updateConfigFile(
  path: string,
  mutate: (raw: Raw) => void,
  renameImpl: typeof rename = rename,
): Promise<void> {
  const next = (queues.get(path) ?? Promise.resolve())
    .catch(() => {})
    .then(() => writeOnce(path, mutate, renameImpl));
  queues.set(path, next);
  const cleanup = () => {
    if (queues.get(path) === next) queues.delete(path);
  };
  next.then(cleanup, cleanup);
  return next;
}

/** Replace `mcpServers` in the config file, keeping all other keys (including `auth`). */
export function saveServers(
  path: string,
  servers: Record<string, McpServerConfig>,
  renameImpl: typeof rename = rename,
): Promise<void> {
  return updateConfigFile(path, (raw) => void (raw.mcpServers = servers), renameImpl);
}
