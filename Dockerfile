FROM oven/bun:latest as base

WORKDIR /app

# Copy package.json and bun.lock
COPY package.json bun.lock ./

# Install dependencies and web-streams-polyfill
RUN bun i && bun add web-streams-polyfill

# Copy the rest of the application
COPY . .

# Use a smaller image for production
FROM oven/bun:latest

WORKDIR /app

# Install curl for healthchecks and debugging tools
RUN apt-get update && apt-get install -y curl jq && rm -rf /var/lib/apt/lists/*

# Copy built application from the base stage
COPY --from=base /app/index.ts /app/index.ts
COPY --from=base /app/chat.ts /app/chat.ts
COPY --from=base /app/chat-client.ts /app/chat-client.ts
COPY --from=base /app/character-gen.ts /app/character-gen.ts
COPY --from=base /app/polyfill.ts /app/polyfill.ts
COPY --from=base /app/node_modules /app/node_modules
COPY --from=base /app/package.json /app/package.json
COPY --from=base /app/deep-research /app/deep-research
COPY --from=base /app/.env.example /app/.env.example

# Set environment variables
ENV NODE_ENV=production

# Wait for ChromaDB to be fully ready before starting the application
CMD ["bun", "index.ts"] 