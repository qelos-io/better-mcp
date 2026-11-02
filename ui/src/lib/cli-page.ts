import { shellLine, type Launch } from "./install";

/** Swap each `better-mcp` binary in a documented example for the command that launches this install. */
export function withLaunch(cmd: string, launch: Launch): string {
  const prefix = shellLine(launch);
  return cmd.replace(/(^|\| )better-mcp /g, (_m, lead: string) => `${lead}${prefix} `);
}
