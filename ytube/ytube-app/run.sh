#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
node -e 'const [major,minor]=process.versions.node.split(".").map(Number);if(major<22||(major===22&&minor<13))process.exit(1)' || { echo 'Install Node.js 22.13 or newer.' >&2; exit 1; }
if [ ! -d node_modules ]; then npm ci --no-audit --no-fund; fi
npm run build
exec node scripts/self-host.mjs --host 127.0.0.1 --port 8080 --state .wrangler/state
