#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { runDaemon } from "./app/daemon.js";
import { runApp } from "./app/app.js";
import { runTools } from "./app/tools.js";
import { bootstrap } from "./app/bootstrap.js";
import { resolveCli } from "./lib/cli.js";

const cli = resolveCli(process.argv.slice(2));
if (cli.action === "exit") {
  if (cli.stdout) process.stdout.write(cli.stdout);
  if (cli.stderr) process.stderr.write(cli.stderr);
  process.exit(cli.code);
}

const entryDir = dirname(fileURLToPath(import.meta.url));

if (cli.action === "tools") {
  runTools({ entryDir, sub: cli.sub, tool: cli.tool, filters: cli.filters, args: cli.args, raw: cli.raw, verbose: cli.verbose, daemon: cli.daemon }).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`[better-mcp] ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    },
  );
} else
(cli.action === "daemon" ? runDaemon({ entryDir }) : cli.action === "app" ? runApp({ entryDir }) : bootstrap({ entryDir })).catch((err) => {
  process.stderr.write(
    `[better-mcp] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
