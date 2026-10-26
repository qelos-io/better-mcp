#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { bootstrap } from "./app/bootstrap.js";
import { resolveCli } from "./lib/cli.js";

const cli = resolveCli(process.argv.slice(2));
if (cli.action === "exit") {
  if (cli.stdout) process.stdout.write(cli.stdout);
  if (cli.stderr) process.stderr.write(cli.stderr);
  process.exit(cli.code);
}

const entryDir = dirname(fileURLToPath(import.meta.url));

bootstrap({ entryDir }).catch((err) => {
  process.stderr.write(
    `[better-mcp] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
