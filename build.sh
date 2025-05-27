#!/bin/bash

docker build --platform linux/amd64 --target production -t agent-explorer:latest .
docker tag agent-explorer:latest europe-southwest1-docker.pkg.dev/daydreams-cloud/eternum/agent-explorer:latest
docker push europe-southwest1-docker.pkg.dev/daydreams-cloud/eternum/agent-explorer:latest

# kubectl scale deployment --selector=app=eternum-explorer-agent-mainnet -n eternum --replicas=0

kubectl rollout restart deployment --selector=app=eternum-explorer-agent-mainnet -n eternum

kubectl scale deployment --selector=app=eternum-explorer-agent-mainnet -n eternum --replicas=1