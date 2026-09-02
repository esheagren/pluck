#!/usr/bin/env bash
# Preview-deploy the API (Vercel project `pluckk-api`) from the repo root; prints the deployment URL.
set -euo pipefail
cd "$(dirname "$0")"
export VERCEL_ORG_ID=$(python3 -c "import json;print(json.load(open('packages/api/.vercel/project.json'))['orgId'])")
export VERCEL_PROJECT_ID=$(python3 -c "import json;print(json.load(open('packages/api/.vercel/project.json'))['projectId'])")
vercel deploy --yes 2>&1 | grep -oE "Error.*|https://pluckk-api-[a-z0-9-]+\.vercel\.app" | tail -1
