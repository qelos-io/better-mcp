export interface ErrorHelp {
  /** Plain-language reason and the next step. */
  hint: string;
  /** The row action that most likely fixes it. */
  action?: "login" | "reconnect";
}

const RULES: { test: RegExp; help: (transport: "http" | "stdio") => ErrorHelp }[] = [
  {
    test: /refused to register better-mcp/i,
    help: () => ({ hint: "This provider only allows approved OAuth clients. Use a pre-registered client ID (oauth.clientId) or another way to connect." }),
  },
  {
    test: /ENOTFOUND|EAI_AGAIN/,
    help: () => ({ hint: "The host name could not be resolved. Check your network or proxy, then reconnect.", action: "reconnect" }),
  },
  {
    test: /ECONNREFUSED/,
    help: () => ({ hint: "Nothing is listening at that address. Make sure the server is running, then reconnect.", action: "reconnect" }),
  },
  {
    test: /ETIMEDOUT|timed out|timeout/i,
    help: () => ({ hint: "The server took too long to answer. Try again.", action: "reconnect" }),
  },
  {
    test: /ENOENT|not found/i,
    help: (t) => ({ hint: t === "stdio" ? "The command was not found. Install it or fix the command path, then reconnect." : "That address was not found. Check the URL." }),
  },
  {
    test: /POSTing to endpoint:\s*$/,
    help: () => ({ hint: "The server rejected the request without saying why. Check the URL and that any API key header is set.", action: "reconnect" }),
  },
  {
    test: /\b401\b|unauthori[sz]ed|requires login/i,
    help: (t) => (t === "http" ? { hint: "The server wants you to log in.", action: "login" } : { hint: "The server rejected the credentials." }),
  },
  {
    test: /\b403\b|forbidden/i,
    help: () => ({ hint: "The server refused access. Check your account's permissions or API key." }),
  },
];

/** A short explanation and next step for a connection error, or null when nothing useful can be said. */
export function explainError(message: string, transport: "http" | "stdio"): ErrorHelp | null {
  for (const rule of RULES) if (rule.test.test(message)) return rule.help(transport);
  return null;
}
