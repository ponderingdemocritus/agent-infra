#!/bin/bash

docker build --platform linux/amd64 --target production -t agent-explorer:latest .
docker tag agent-explorer:latest europe-southwest1-docker.pkg.dev/daydreams-cloud/eternum/agent-explorer:latest
docker push europe-southwest1-docker.pkg.dev/daydreams-cloud/eternum/agent-explorer:latest