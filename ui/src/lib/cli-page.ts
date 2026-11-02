import { shellLine, shellQuote, type Launch } from "./install";

export interface CliInfo extends Launch {
  configArgs: string[];
  globalInstalled: boolean;
  namespace: boolean;
}

/** The command that runs better-mcp in a shell: the global binary when installed, else npx. */
export function cliLaunch(info: CliInfo): Launch {
  return info.globalInstalled ? { command: "better-mcp", args: info.configArgs } : info;
}

export const GLOBAL_INSTALL_CMD = "npm install -g @qelos/better-mcp";

/** Shell command that runs one tool with the given arguments. */
export function toolCallCommand(info: CliInfo, server: string, tool: string, args: Record<string, unknown>): string {
  const name = info.namespace ? `${server}__${tool}` : tool;
  const json = Object.keys(args).length ? shellQuote(JSON.stringify(args)) : "'{}'";
  return `${shellLine(cliLaunch(info))} tools call ${shellQuote(name)} ${json}`;
}

/** Swap each `better-mcp` binary in a documented example for the command that launches this install. */
export function withLaunch(cmd: string, launch: Launch): string {
  const prefix = shellLine(launch);
  return cmd.replace(/(^|\| )better-mcp /g, (_m, lead: string) => `${lead}${prefix} `);
}
