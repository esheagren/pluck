#!/usr/bin/env bash
# Deploy the webapp (Vercel project `pluck`) to production from the repo root.
# Needed because the project's Root Directory is packages/webapp, so the CLI
# must run at the root with the project identity supplied via env.
set -euo pipefail
cd "$(dirname "$0")"
export VERCEL_ORG_ID=$(python3 -c "import json;print(json.load(open('packages/webapp/.vercel/project.json'))['orgId'])")
export VERCEL_PROJECT_ID=$(python3 -c "import json;print(json.load(open('packages/webapp/.vercel/project.json'))['projectId'])")
vercel deploy --prod --yes 2>&1 | grep -oE "Error.*|https://pluck-[a-z0-9-]+\.vercel\.app" | tail -1
