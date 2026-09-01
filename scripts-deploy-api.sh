#!/usr/bin/env bash
# Deploy the API (Vercel project `pluckk-api`) to production from the repo root.
set -euo pipefail
cd "$(dirname "$0")"
export VERCEL_ORG_ID=$(python3 -c "import json;print(json.load(open('packages/api/.vercel/project.json'))['orgId'])")
export VERCEL_PROJECT_ID=$(python3 -c "import json;print(json.load(open('packages/api/.vercel/project.json'))['projectId'])")
vercel deploy --prod --yes 2>&1 | grep -oE "Error.*|https://pluckk-api\.vercel\.app" | tail -1
