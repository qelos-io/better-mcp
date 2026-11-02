/** Pure docs for `better-mcp tools`, shared by `--help` and the management app's Command line page. */

export interface ToolsCommandDoc {
  id: "ls" | "describe" | "call";
  usage: string;
  summary: string;
  details: string[];
  examples: { cmd: string; note: string }[];
}

export const TOOLS_COMMANDS: ToolsCommandDoc[] = [
  {
    id: "ls",
    usage: "better-mcp tools ls [filters...]",
    summary: "List the tools you can call, by public name.",
    details: [
      "Filters are case-insensitive substrings matched against the name and the description; a tool is kept when it matches any filter.",
      "Prints a sorted JSON array. Alias: list.",
    ],
    examples: [
      { cmd: "better-mcp tools ls", note: "Every callable tool" },
      { cmd: "better-mcp tools ls github issue", note: "Tools matching “github” or “issue”" },
    ],
  },
  {
    id: "describe",
    usage: "better-mcp tools describe <tool>",
    summary: "Show a tool's description and input schema.",
    details: ["Prints JSON with name, server, description, inputSchema and annotations. Read it before calling a tool."],
    examples: [{ cmd: "better-mcp tools describe github__get_issue", note: "Schema for one tool" }],
  },
  {
    id: "call",
    usage: "better-mcp tools call <tool> [json] [--raw]",
    summary: "Run a tool and print its result as JSON.",
    details: [
      "Arguments are a JSON object, given inline or piped on stdin (use - to force stdin). Without arguments and with a non-TTY stdin it reads stdin, so pass {} in scripts that have none.",
      "The result goes through the middleware pipeline (redaction, compaction, offloading…) exactly as an MCP client would receive it. --raw prints the upstream's own response instead.",
      "Exits 1 on a tool error or an unknown tool. Logs go to stderr, so stdout stays clean for pipes.",
    ],
    examples: [
      { cmd: `better-mcp tools call github__get_issue '{"number": 5}'`, note: "Inline arguments" },
      { cmd: "cat body.json | better-mcp tools call github__get_issue", note: "Arguments from a file or pipe" },
      { cmd: "better-mcp tools call github__get_issue '{\"number\": 5}' --raw", note: "Compare with the unprocessed response" },
    ],
  },
];

export const TOOLS_NAMING_NOTE =
  "<tool> is the public name (server__tool, or just the tool name when namespacing is off). A bare tool name works when only one server has it.";

export function toolsHelpText(): string {
  const blocks = TOOLS_COMMANDS.map((c) =>
    [`  ${c.usage}`, `      ${c.summary}`, ...c.details.map((d) => `      ${d}`), "", ...c.examples.map((e) => `      $ ${e.cmd}`)].join("\n"),
  );
  return `better-mcp tools: use the connected servers' tools from the shell

Commands

${blocks.join("\n\n")}

${TOOLS_NAMING_NOTE}
Use -c <file> (before or after "tools") to pick a config. Manage servers in the app: better-mcp app
`;
}
