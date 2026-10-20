import { chmod } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { updateConfigFile } from "../config/writer.js";
import type { CredentialStore, StoredCredentials } from "./oauth.js";

type Scope = "all" | "client" | "tokens" | "verifier";

/**
 * Keeps OAuth client registration + tokens in the config file itself, under a
 * top-level `auth` key (sibling of `mcpServers`), so every client and session
 * using that config shares one login. The PKCE verifier only matters within a
 * single login, so it stays in memory.
 */
export class ConfigCredentialStore implements CredentialStore {
  private codeVerifier?: string;

  constructor(
    private readonly path: string,
    private readonly key: string,
  ) {}

  async read(): Promise<StoredCredentials> {
    let saved: StoredCredentials = {};
    try {
      const raw = JSON.parse(await readFile(this.path, "utf8")) as { auth?: Record<string, StoredCredentials> };
      saved = raw.auth?.[this.key] ?? {};
    } catch {
      /* unreadable config: behave as logged out */
    }
    return this.codeVerifier ? { ...saved, codeVerifier: this.codeVerifier } : saved;
  }

  async update(patch: Partial<StoredCredentials>): Promise<void> {
    const { codeVerifier, ...persisted } = patch;
    if ("codeVerifier" in patch) this.codeVerifier = codeVerifier;
    if (Object.keys(persisted).length === 0) return;
    await this.mutate((entry) => {
      for (const [k, v] of Object.entries(persisted)) {
        if (v === undefined) delete entry[k];
        else entry[k] = v;
      }
    });
  }

  async clear(scope: Scope): Promise<void> {
    if (scope === "verifier" || scope === "all") this.codeVerifier = undefined;
    if (scope === "verifier") return;
    await this.mutate((entry) => {
      if (scope === "all") for (const k of Object.keys(entry)) delete entry[k];
      else delete entry[scope === "client" ? "clientInformation" : "tokens"];
    });
  }

  private async mutate(fn: (entry: Record<string, unknown>) => void): Promise<void> {
    await updateConfigFile(this.path, (raw) => {
      const auth = ((raw.auth as Record<string, Record<string, unknown>> | undefined) ??= {});
      const entry = (auth[this.key] ??= {});
      fn(entry);
      if (Object.keys(entry).length === 0) delete auth[this.key];
      if (Object.keys(auth).length === 0) delete raw.auth;
    });
    // Tokens now live in this file; best effort to keep it private (may fail on bind mounts).
    await chmod(this.path, 0o600).catch(() => {});
  }
}
