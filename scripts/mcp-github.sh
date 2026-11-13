#!/bin/bash
# Starts a local proxy to the GitHub MCP server. The token is loaded from the project's .env
# and substituted by mcp-remote itself (it is never written in this file or in .mcp.json).
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
set -a
source "$ROOT/.env"
set +a
export PATH="$HOME/.local/node/bin:$PATH"
export GITHUB_AUTH="Bearer $GITHUB_PERSONAL_ACCESS_TOKEN"
exec mcp-remote https://api.githubcopilot.com/mcp/ --header 'Authorization:${GITHUB_AUTH}'
