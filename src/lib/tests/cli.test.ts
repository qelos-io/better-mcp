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
