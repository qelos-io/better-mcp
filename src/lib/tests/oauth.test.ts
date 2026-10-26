import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BetterMcpOAuthProvider,
  CallbackHub,
  FileCredentialStore,
  browserCommand,
  callbackUrl,
  credentialsFileName,
  defaultAuthDir,
  shouldUseOAuth,
} from "../oauth.js";

const randomPort = () => 40000 + Math.floor(Math.random() * 20000);

test("shouldUseOAuth: on by default for url servers", () => {
  assert.equal(shouldUseOAuth({ url: "https://x/mcp" }), true);
});

test("shouldUseOAuth: off when an Authorization header is set (any case)", () => {
  assert.equal(shouldUseOAuth({ url: "https://x", headers: { authorization: "Bearer t" } }), false);
  assert.equal(shouldUseOAuth({ url: "https://x", headers: { "X-Other": "1" } }), true);
});

test("shouldUseOAuth: explicit oauth setting wins", () => {
  assert.equal(shouldUseOAuth({ url: "https://x", oauth: false }), false);
  assert.equal(
    shouldUseOAuth({ url: "https://x", oauth: true, headers: { Authorization: "Bearer t" } }),
    true,
  );
  assert.equal(shouldUseOAuth({ url: "https://x", oauth: { clientId: "a" } }), true);
});

test("credentialsFileName: sanitized and url-sensitive", () => {
  const a = credentialsFileName("my/server", "https://a/mcp");
  assert.match(a, /^my_server-[0-9a-f]{8}\.json$/);
  assert.notEqual(a, credentialsFileName("my/server", "https://b/mcp"));
  assert.equal(a, credentialsFileName("my/server", "https://a/mcp"));
});

test("browserCommand: per-platform launcher", () => {
  assert.deepEqual(browserCommand("darwin", "https://u"), { cmd: "open", args: ["https://u"] });
  assert.deepEqual(browserCommand("linux", "https://u"), { cmd: "xdg-open", args: ["https://u"] });
  const win = browserCommand("win32", "https://u?a=1&b=2");
  assert.equal(win.cmd, "cmd");
  assert.ok(win.args.includes("https://u?a=1^&b=2"));
});

test("FileCredentialStore: round-trips, merges, clears, 0600", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bm-oauth-"));
  const store = new FileCredentialStore(join(dir, "nested", "s.json"));
  assert.deepEqual(await store.read(), {});
  await store.update({ codeVerifier: "v" });
  await store.update({ tokens: { access_token: "t", token_type: "Bearer" } });
  const got = await store.read();
  assert.equal(got.codeVerifier, "v");
  assert.equal(got.tokens?.access_token, "t");
  assert.equal((await stat(join(dir, "nested", "s.json"))).mode & 0o777, 0o600);
  await store.clear("tokens");
  assert.equal((await store.read()).tokens, undefined);
  assert.equal((await store.read()).codeVerifier, "v");
  await store.clear("all");
  assert.equal((await store.read()).codeVerifier, undefined);
});

test("CallbackHub: routes code by state and serves success page", async () => {
  const port = randomPort();
  const hub = new CallbackHub(port);
  await hub.start();
  try {
    const p1 = hub.expect("s1");
    const p2 = hub.expect("s2");
    const r2 = await fetch(`${callbackUrl(port)}?code=c2&state=s2`);
    const r1 = await fetch(`${callbackUrl(port)}?code=c1&state=s1`);
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.match(await r1.text(), /signed in/);
    assert.equal(await p1, "c1");
    assert.equal(await p2, "c2");
  } finally {
    await hub.close();
  }
});

test("CallbackHub: error response rejects the waiter; unknown state is 400", async () => {
  const port = randomPort();
  const hub = new CallbackHub(port);
  await hub.start();
  try {
    const p = hub.expect("s");
    const settled = assert.rejects(p, /access_denied/);
    assert.equal((await fetch(`${callbackUrl(port)}?code=x&state=nope`)).status, 400);
    assert.equal((await fetch(`${callbackUrl(port)}?error=access_denied&state=s`)).status, 400);
    await settled;
    assert.equal((await fetch(`http://localhost:${port}/other`)).status, 404);
  } finally {
    await hub.close();
  }
});

test("CallbackHub: expect times out", async () => {
  const hub = new CallbackHub(randomPort());
  await assert.rejects(hub.expect("s", 10), /timed out/);
});

test("CallbackHub: reports port conflicts clearly", async () => {
  const port = randomPort();
  const a = new CallbackHub(port);
  await a.start();
  try {
    await assert.rejects(new CallbackHub(port).start(), /already in use/);
  } finally {
    await a.close();
  }
});

async function makeProvider(config = {}, port = 33418) {
  const dir = await mkdtemp(join(tmpdir(), "bm-oauth-"));
  const opened: string[] = [];
  const hubPort = randomPort();
  const hub = new CallbackHub(hubPort);
  const codes: string[] = [];
  const provider = new BetterMcpOAuthProvider({
    serverName: "srv",
    config,
    port: hubPort,
    hub,
    store: new FileCredentialStore(join(dir, "s.json")),
    openUrl: (u) => opened.push(u),
    onCode: () => void codes.push("code"),
  });
  return { provider, hub, opened, hubPort, port, codes };
}

test("provider: metadata advertises loopback redirect and scopes", async () => {
  const { provider, hubPort } = await makeProvider({ scopes: ["a", "b"] });
  assert.deepEqual(provider.clientMetadata.redirect_uris, [callbackUrl(hubPort)]);
  assert.equal(provider.clientMetadata.scope, "a b");
  assert.equal(provider.clientMetadata.token_endpoint_auth_method, "none");
  const withSecret = await makeProvider({ clientId: "i", clientSecret: "s" });
  assert.equal(withSecret.provider.clientMetadata.token_endpoint_auth_method, "client_secret_post");
});

test("provider: configured clientId wins over stored registration", async () => {
  const { provider } = await makeProvider({ clientId: "cid", clientSecret: "sec" });
  assert.deepEqual(await provider.clientInformation(), { client_id: "cid", client_secret: "sec" });
});

test("provider: stored registration for a different callback port is discarded", async () => {
  const { provider, hubPort } = await makeProvider();
  await provider.saveClientInformation({ client_id: "old", redirect_uris: ["http://localhost:1/callback"] } as never);
  assert.equal(await provider.clientInformation(), undefined);
  await provider.saveClientInformation({ client_id: "ok", redirect_uris: [callbackUrl(hubPort)] } as never);
  assert.equal((await provider.clientInformation())?.client_id, "ok");
});

test("provider: tokens and code verifier persist; missing verifier throws", async () => {
  const { provider } = await makeProvider();
  await assert.rejects(provider.codeVerifier(), /verifier/);
  await provider.saveCodeVerifier("v");
  await provider.saveTokens({ access_token: "t", token_type: "Bearer" });
  assert.equal(await provider.codeVerifier(), "v");
  assert.equal((await provider.tokens())?.access_token, "t");
  await provider.invalidateCredentials("tokens");
  assert.equal(await provider.tokens(), undefined);
});

test("provider: redirectToAuthorization opens browser and waitForCode resolves on callback", async () => {
  const { provider, hub, opened, hubPort, codes } = await makeProvider();
  try {
    await assert.rejects(provider.waitForCode(), /no login/);
    const state = provider.state();
    const url = new URL("https://auth.example/authorize");
    url.searchParams.set("state", state);
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (() => true) as typeof process.stderr.write;
    try {
      await provider.redirectToAuthorization(url);
    } finally {
      process.stderr.write = origWrite;
    }
    assert.deepEqual(opened, [url.toString()]);
    await fetch(`${callbackUrl(hubPort)}?code=abc&state=${state}`);
    assert.equal(await provider.waitForCode(), "abc");
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(codes, ["code"]);
  } finally {
    await hub.close();
  }
});

test("provider: non-interactive redirect records loginRequired and opens nothing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bm-oauth-"));
  const opened: string[] = [];
  const hub = new CallbackHub(randomPort());
  const provider = new BetterMcpOAuthProvider({
    serverName: "s", config: {}, port: 1, hub, interactive: false,
    store: new FileCredentialStore(join(dir, "s.json")),
    openUrl: (u) => opened.push(u),
  });
  assert.equal(provider.loginRequired, false);
  await provider.redirectToAuthorization(new URL("https://auth.example/authorize"));
  assert.equal(provider.loginRequired, true);
  assert.deepEqual(opened, []);
  assert.equal(hub.pendingCount, 0);
});

test("defaultAuthDir: honours BETTER_MCP_HOME", () => {
  assert.equal(defaultAuthDir({ BETTER_MCP_HOME: "/data" }), join("/data", "auth"));
  assert.match(defaultAuthDir({}), /\.better-mcp[\\/]auth$/);
});

test("provider: onAuthUrl receives the login URL", async () => {
  const { provider, hub } = await makeProvider();
  const seen: string[] = [];
  (provider as unknown as { opts: { onAuthUrl?: (u: string) => void } }).opts.onAuthUrl = (u) => seen.push(u);
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (() => true) as typeof process.stderr.write;
  try {
    await provider.redirectToAuthorization(new URL("https://auth.example/authorize?state=zz"));
  } finally {
    process.stderr.write = origWrite;
    await hub.close();
  }
  assert.deepEqual(seen, ["https://auth.example/authorize?state=zz"]);
});

test("CallbackHub: binds to the provided host", async () => {
  const port = randomPort();
  const hub = new CallbackHub(port, "127.0.0.1");
  await hub.start();
  try {
    assert.equal((await fetch(`http://127.0.0.1:${port}/callback?code=x&state=none`)).status, 400);
  } finally {
    await hub.close();
  }
});

import { credentialsKey } from "../oauth.js";

test("credentialsKey: file name is the key plus .json", () => {
  assert.equal(`${credentialsKey("s", "https://a")}.json`, credentialsFileName("s", "https://a"));
});

test("provider: validateResourceURL accepts the advertised resource even if its path differs", async () => {
  const { provider, hub } = await makeProvider();
  try {
    const url = await provider.validateResourceURL("https://x.example/sse", "https://x.example/mcp");
    assert.equal(url?.href, "https://x.example/mcp");
    assert.equal(await provider.validateResourceURL("https://x.example/sse", undefined), undefined);
  } finally {
    await hub.close();
  }
});
