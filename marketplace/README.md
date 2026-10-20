# Marketplace

`servers.yaml` is the community registry behind the better-mcp marketplace page
(`docs/marketplace/index.html`, generated). Each entry becomes a card with
one-click install for Cursor and VS Code, plus copy buttons for Claude Code and
`mcp.json`.

## Add a server

1. Append an entry to `servers.yaml`:

   ```yaml
   - id: my-server              # lowercase, digits, dashes; unique
     name: My Server
     description: One sentence on what it does.
     category: Developer tools  # reuse an existing category when one fits
     homepage: https://github.com/you/my-server
     logo: https://cdn.simpleicons.org/github   # optional, https; letter fallback if omitted
     tags: [search, api]        # optional
     setup: Set MY_API_KEY.     # optional, shown on the card
     config:                    # same shape as an `mcpServers` entry
       command: npx
       args: ["-y", "my-server-mcp"]
       env:
         MY_API_KEY: "${MY_API_KEY}"
   ```

   Remote servers use `config: { url: https://… }` instead of `command`; OAuth
   login is automatic. Never put real secrets in `config` — use `${VAR}`.

   Quote any `description` or `setup` that contains `: ` (YAML would read it as a nested mapping).

2. Run `npm run marketplace:build` and commit the regenerated `docs/marketplace/`.
3. `npm test` validates the registry. Open a PR.
