#!/bin/bash
# Starts the n8n MCP server with keys loaded from the project's .env (never hardcoded).
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
set -a
source "$ROOT/.env"
set +a
export PATH="$HOME/.local/node/bin:$PATH"
export MCP_MODE=stdio LOG_LEVEL=error DISABLE_CONSOLE_OUTPUT=true
exec n8n-mcp
