import * as http from "node:http";

const PROXY_VARS = ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"];

/**
 * Node's fetch ignores proxy env vars by default. Hosts that sandbox stdio
 * servers route traffic through a proxy and leave DNS unresolvable, so remote
 * servers fail with ENOTFOUND unless fetch honors those vars.
 */
export function enableEnvProxy(
  env: NodeJS.ProcessEnv = process.env,
  api: { setGlobalProxyFromEnv?: (env?: NodeJS.ProcessEnv) => unknown } = http as never,
): boolean {
  if (!PROXY_VARS.some((k) => env[k])) return false;
  if (typeof api.setGlobalProxyFromEnv !== "function") return false;
  api.setGlobalProxyFromEnv(env);
  return true;
}
