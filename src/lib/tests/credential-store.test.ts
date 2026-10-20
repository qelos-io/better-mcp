import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigCredentialStore } from "../credential-store.js";

async function setup(initial: object = { mcpServers: { a: { url: "https://a" } } }) {
  const dir = await mkdtemp(join(tmpdir(), "bm-cred-"));
  const path = join(dir, "mcp.json");
  await writeFile(path, JSON.stringify(initial));
  const json = async () => JSON.parse(await readFile(path, "utf8"));
  return { path, json };
}

const tokens = { access_token: "t", token_type: "Bearer" };

test("stores credentials under top-level auth[key], leaving mcpServers untouched", async () => {
  const { path, json } = await setup();
  const store = new ConfigCredentialStore(path, "a-1234");
  await store.update({ tokens });
  await store.update({ clientInformation: { client_id: "c" } });
  const got = await json();
  assert.deepEqual(got.mcpServers, { a: { url: "https://a" } });
  assert.deepEqual(got.auth, { "a-1234": { tokens, clientInformation: { client_id: "c" } } });
  assert.equal((await stat(path)).mode & 0o777, 0o600);
});

test("a fresh store instance (new session / other client) reads the same login", async () => {
  const { path } = await setup();
  await new ConfigCredentialStore(path, "k").update({ tokens });
  assert.deepEqual((await new ConfigCredentialStore(path, "k").read()).tokens, tokens);
  assert.deepEqual(await new ConfigCredentialStore(path, "other").read(), {});
});

test("code verifier stays in memory and never reaches the file", async () => {
  const { path, json } = await setup();
  const store = new ConfigCredentialStore(path, "k");
  await store.update({ codeVerifier: "secret-verifier" });
  assert.equal((await store.read()).codeVerifier, "secret-verifier");
  assert.equal((await json()).auth, undefined);
  assert.equal((await new ConfigCredentialStore(path, "k").read()).codeVerifier, undefined);
  await store.clear("verifier");
  assert.equal((await store.read()).codeVerifier, undefined);
});

test("clear tokens/client/all; empty auth section is removed", async () => {
  const { path, json } = await setup();
  const store = new ConfigCredentialStore(path, "k");
  await store.update({ tokens, clientInformation: { client_id: "c" } });
  await store.clear("tokens");
  assert.deepEqual((await json()).auth.k, { clientInformation: { client_id: "c" } });
  await store.clear("all");
  assert.equal((await json()).auth, undefined);
});

test("update with undefined removes the field", async () => {
  const { path, json } = await setup();
  const store = new ConfigCredentialStore(path, "k");
  await store.update({ tokens, clientInformation: { client_id: "c" } });
  await store.update({ tokens: undefined });
  assert.deepEqual((await json()).auth.k, { clientInformation: { client_id: "c" } });
});

test("two servers updating concurrently both persist", async () => {
  const { path, json } = await setup();
  await Promise.all([
    new ConfigCredentialStore(path, "x").update({ tokens }),
    new ConfigCredentialStore(path, "y").update({ tokens }),
  ]);
  assert.deepEqual(Object.keys((await json()).auth).sort(), ["x", "y"]);
});

test("unreadable config reads as logged out", async () => {
  const store = new ConfigCredentialStore("/nonexistent/mcp.json", "k");
  assert.deepEqual(await store.read(), {});
});
