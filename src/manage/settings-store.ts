import { readFile } from "node:fs/promises";
import { updateConfigFile } from "../config/writer.js";
import { applySettingsPatch } from "./settings-schema.js";

export interface SettingsStore {
  read(): Promise<Record<string, unknown>>;
  /** Absent when the config can't be written back (inline JSON). */
  write?(patch: Record<string, unknown>): Promise<void>;
}

export function fileSettingsStore(path: string): SettingsStore {
  return {
    async read() {
      return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    },
    write: (patch) => updateConfigFile(path, (raw) => applySettingsPatch(raw, patch)),
  };
}

export function readOnlySettingsStore(config: Record<string, unknown>): SettingsStore {
  return { read: async () => config };
}
