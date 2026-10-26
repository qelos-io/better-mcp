# syntax=docker/dockerfile:1.7

# ---------- builder ----------
# Full Node + dev deps; compile TypeScript once.
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY ui ./ui
RUN npm run build

# ---------- runtime ----------
# Slim image with only the compiled JS and prod deps. Driven over stdio by
# an MCP host (Claude Desktop, Cursor, etc.).
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
# Offline fallback for the marketplace catalog.
COPY docs/marketplace/servers.json ./docs/marketplace/servers.json

# OAuth state (when `authStorage: "home"`) lives in /data; mount a volume to keep it.
# The management app (33419) and OAuth callback (33418) bind 0.0.0.0 INSIDE the
# container so published ports reach them — publish them on loopback only:
#   -p 127.0.0.1:33419:33419 -p 127.0.0.1:33418:33418
ENV BETTER_MCP_HOME=/data \
    BETTER_MCP_MANAGE_HOST=0.0.0.0 \
    BETTER_MCP_MANAGE_PORT=33419 \
    BETTER_MCP_CALLBACK_HOST=0.0.0.0
VOLUME /data
EXPOSE 33418 33419

# Mount your mcp.json at /app/mcp.json (auto-discovered) or pass `-c <path>`.
# For offload output, mount a writable volume and set `middleware.offload.dir`
# in your mcp.json to that path (e.g. /exports).
ENTRYPOINT ["node", "/app/dist/index.js"]
