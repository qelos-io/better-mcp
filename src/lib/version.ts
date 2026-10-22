import { readFileSync } from "node:fs";

/** Package version, read from package.json (resolves from both src/ and dist/). */
export const VERSION: string = (
  JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string }
).version;

export function startupBanner(nodeVersion = process.version, platform = process.platform, arch = process.arch): string {
  return `@qelos/better-mcp v${VERSION} (node ${nodeVersion}, ${platform}-${arch})`;
}
