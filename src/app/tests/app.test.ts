import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../../index.ts", import.meta.url));

test("better-mcp app: serves only the management UI for the given config, no stdio traffic", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bm-app-"));
  const config = join(dir, "mcp.json");
  await writeFile(config, JSON.stringify({ mcpServers: { off: { command: "unused", enabled: false } } }));
  // A no-op `open` so the test never launches a real browser.
  const bin = join(dir, "bin");
  await mkdir(bin);
  for (const name of ["open", "xdg-open"]) {
    await writeFile(join(bin, name), "#!/bin/sh\nexit 0\n");
    await chmod(join(bin, name), 0o755);
  }

  const child = spawn(process.execPath, ["--import", "tsx", entry, "app", "--config", config], {
    env: { ...process.env, PATH: bin + delimiter + process.env.PATH, BETTER_MCP_MANAGE_PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (d: Buffer) => (out += d));
  try {
    const url = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("app did not print its URL")), 15000);
      child.stdout.on("data", () => {
        const m = /(http:\/\/127\.0\.0\.1:\d+\/[0-9a-f]+\/)/.exec(out);
        if (m) {
          clearTimeout(timer);
          resolve(m[1]);
        }
      });
      child.once("exit", (code) => reject(new Error(`app exited early with ${code}`)));
    });
    const state = (await (await fetch(url + "api/state")).json()) as { servers: { name: string; status: string }[]; persistent: boolean };
    assert.deepEqual(state.servers.map((s) => [s.name, s.status]), [["off", "disabled"]]);
    assert.equal(state.persistent, true);
    assert.doesNotMatch(out, /jsonrpc/);
  } finally {
    child.kill("SIGTERM");
  }
});
