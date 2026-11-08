#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v gcloud >/dev/null || { echo 'Install the Google Cloud CLI first; see docs/DEPLOYMENT.md.' >&2; exit 1; }
test -f .deploy/cloud-run/public/index.html || { echo 'Run npm run deploy:prepare first.' >&2; exit 1; }
gcloud run deploy hollywood-poster \
  --project=gen-lang-client-0306587402 \
  --source=.deploy/cloud-run --region=asia-east1 --platform=managed \
  --port=8080 --cpu=1 --memory=256Mi \
  --min-instances=0 --max-instances=2 --concurrency=80 --timeout=60 \
  --service-account=hollywood-web-runtime@gen-lang-client-0306587402.iam.gserviceaccount.com \
  --allow-unauthenticated
