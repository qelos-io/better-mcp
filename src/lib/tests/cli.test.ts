import { test } from "node:test";
import assert from "node:assert/strict";
import { helpText, resolveCli } from "../cli.js";
import { VERSION } from "../version.js";

test("resolveCli: no args or only config flags starts the proxy", () => {
  assert.deepEqual(resolveCli([]), { action: "run" });
  assert.deepEqual(resolveCli(["-c", "mcp.json"]), { action: "run" });
  assert.deepEqual(resolveCli(["--config=mcp.json", "--no-namespace", "--listen", "3100"]), { action: "run" });
});

test("resolveCli: version in every spelling prints the banner and exits 0", () => {
  for (const argv of [["version"], ["--version"], ["-v"], ["-V"], ["VERSION"]]) {
    const r = resolveCli(argv);
    assert.equal(r.action, "exit");
    assert.equal((r as { code: number }).code, 0);
    assert.match((r as { stdout: string }).stdout, new RegExp(`@qelos/better-mcp v${VERSION.replace(/\./g, "\\.")}`));
  }
});

test("resolveCli: help in every spelling prints usage and exits 0", () => {
  for (const argv of [["help"], ["--help"], ["-h"], ["-c", "x.json", "--help"]]) {
    const r = resolveCli(argv);
    assert.equal(r.action, "exit");
    assert.equal((r as { stdout: string }).stdout, helpText());
  }
  assert.match(helpText(), /better-mcp version/);
  assert.match(helpText(), /--config/);
});

test("resolveCli: app selects the management-app-only mode, with or without a config", () => {
  assert.deepEqual(resolveCli(["app"]), { action: "app" });
  assert.deepEqual(resolveCli(["app", "--config", "my.json"]), { action: "app" });
  assert.deepEqual(resolveCli(["app", "-c", "my.json"]), { action: "app" });
  assert.deepEqual(resolveCli(["-c", "my.json", "app"]), { action: "app" });
  assert.match(helpText(), /better-mcp app/);
});

test("resolveCli: a flag's value is never read as a command", () => {
  assert.deepEqual(resolveCli(["-c", "help"]), { action: "run" });
  assert.deepEqual(resolveCli(["--listen-path", "version"]), { action: "run" });
});

test("resolveCli: an unknown command fails with usage on stderr", () => {
  const r = resolveCli(["versoin"]);
  assert.equal(r.action, "exit");
  assert.equal((r as { code: number }).code, 2);
  assert.match((r as { stderr: string }).stderr, /Unknown command "versoin"/);
});

test("resolveCli: tools call takes a tool and optional inline JSON", () => {
  assert.deepEqual(resolveCli(["tools", "call", "s__t"]), { action: "tools", sub: "call", tool: "s__t", args: undefined, raw: false, verbose: false, daemon: true });
  assert.deepEqual(resolveCli(["-c", "x.json", "tools", "call", "t", '{"a":5}', "--raw"]), {
    action: "tools",
    sub: "call",
    tool: "t",
    args: '{"a":5}',
    raw: true,
    verbose: false,
    daemon: true,
  });
  assert.equal((resolveCli(["tools", "call", "t", "-"]) as { args: string }).args, "-");
});

test("resolveCli: tools describe and list", () => {
  assert.deepEqual(resolveCli(["tools", "describe", "t"]), { action: "tools", sub: "describe", tool: "t", raw: false, verbose: false, daemon: true });
  assert.deepEqual(resolveCli(["tools", "list"]), { action: "tools", sub: "list", filters: [], raw: false, verbose: false, daemon: true });
  assert.deepEqual(resolveCli(["tools", "ls", "git", "issue"]), { action: "tools", sub: "list", filters: ["git", "issue"], raw: false, verbose: false, daemon: true });
});

test("resolveCli: malformed tools commands are usage errors", () => {
  for (const argv of [["tools"], ["tools", "nope"], ["tools", "call"], ["tools", "describe"], ["tools", "call", "a", "{}", "x"]]) {
    const r = resolveCli(argv);
    assert.equal(r.action, "exit");
    assert.equal((r as { code: number }).code, 2);
  }
});

test("resolveCli: help tools and tools --help print the detailed tools help", () => {
  for (const argv of [["help", "tools"], ["tools", "--help"], ["tools", "call", "-h"]]) {
    const r = resolveCli(argv) as { code: number; stdout: string };
    assert.equal(r.code, 0);
    assert.match(r.stdout, /better-mcp tools call <tool>/);
    assert.match(r.stdout, /better-mcp tools describe <tool>/);
  }
  assert.equal((resolveCli(["help"]) as { stdout: string }).stdout, helpText());
});

test("resolveCli: bare tools shows the tools help with exit 2", () => {
  const r = resolveCli(["tools"]) as { code: number; stderr: string };
  assert.equal(r.code, 2);
  assert.match(r.stderr, /better-mcp tools ls/);
});

test("resolveCli: --verbose and --no-daemon are tools flags; __daemon is internal", () => {
  const r = resolveCli(["tools", "ls", "--verbose", "--no-daemon"]) as { verbose: boolean; daemon: boolean; filters: string[] };
  assert.equal(r.verbose, true);
  assert.equal(r.daemon, false);
  assert.deepEqual(r.filters, []);
  assert.deepEqual(resolveCli(["__daemon", "-c", "x.json"]), { action: "daemon" });
});
