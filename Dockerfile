FROM oven/bun:1.0 as base

WORKDIR /app

# Copy package.json and bun.lock
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Build the application (if needed)
RUN bun build --target=bun ./index.ts --outdir=./dist

# Use a smaller image for production
FROM oven/bun:1.0-slim

WORKDIR /app

# Copy built application from the base stage
COPY --from=base /app/dist /app/dist
COPY --from=base /app/node_modules /app/node_modules
COPY --from=base /app/package.json /app/package.json
COPY --from=base /app/.env /app/.env
COPY --from=base /app/deep-research /app/deep-research

# Set environment variables
ENV NODE_ENV=production

# Run the application
CMD ["bun", "dist/index.js"] 