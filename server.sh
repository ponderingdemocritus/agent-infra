#!/usr/bin/env bash
set -Eeuo pipefail

go run main.go \
  --namespace=dreams-agents \
  --agent-image=us-central1-docker.pkg.dev/eternum-1/dreams-agents-repo/dreams-agents-client:latest \
  --contract="0x4726e48f50c7bfcb4eb7d89790fdf2718911207f3e8d90ada0caf36c4ff2c23" \
  --selector="0x4843fbb65c717bb5ece80d635a568aa1c688f880f0519e3de18bf3bae89abf8" \
  --env-file=".env" 


kubectl get deployment dreams-agents-server-deployment -n my-agents && kubectl get pods -n my-agents -l app=dreams-agents-server