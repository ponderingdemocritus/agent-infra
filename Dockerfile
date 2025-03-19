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
COPY --from=base /app/src /app/src
COPY --from=base /app/node_modules /app/src/node_modules
COPY --from=base /app/package.json /app/src/package.json
COPY --from=base /app/.env.example /app/src/.env.example

# Set environment variables
ENV NODE_ENV=production

CMD ["bun", "src/index.ts"] 