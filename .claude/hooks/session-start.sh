#!/bin/bash
set -euo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then exit 0; fi
cd "$CLAUDE_PROJECT_DIR"
if [ ! -d node_modules ]; then npm install --no-audit --no-fund; fi
if ! command -v graphify >/dev/null 2>&1; then pip install --quiet graphifyy; fi
graphify hook install
graphify update .
