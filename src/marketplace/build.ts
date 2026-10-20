import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRegistry } from "./registry.js";
import { renderPage, toCatalog } from "./render.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = resolve(root, "docs/marketplace");

const entries = parseRegistry(await readFile(resolve(root, "marketplace/servers.yaml"), "utf8"));
await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, "index.html"), renderPage(entries));
await writeFile(resolve(outDir, "servers.json"), JSON.stringify(toCatalog(entries), null, 2) + "\n");
process.stdout.write(`marketplace: ${entries.length} servers -> docs/marketplace/\n`);
