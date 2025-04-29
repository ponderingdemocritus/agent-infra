
# Create namespace
kubectl create namespace dreams-agents

# Create secret
kubectl create secret generic agent-api-keys \
  --from-literal=anthropic-api-key='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' \
  --from-literal=openai-api-key='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' \
  --from-literal=openrouter-api-key='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' \
  --namespace dreams-agents




gcloud container clusters create dreams-agents-cluster \
  --region us-central1 \
  --machine-type e2-medium \
  --num-nodes 1 \
  --enable-autoscaling --min-nodes 1 --max-nodes 3 \
  --release-channel regular


gcloud container clusters get-credentials dreams-agents-cluster --region us-central1


gcloud artifacts repositories create dreams-agents-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="Dreams agents images" \
  --project=eternum-1

gcloud auth configure-docker us-central1-docker.pkg.dev

docker build -t us-central1-docker.pkg.dev/eternum-1/dreams-agents-repo/dreams-agents-server:latest -f Dockerfile .

docker push us-central1-docker.pkg.dev/eternum-1/dreams-agents-repo/dreams-agents-server:latest