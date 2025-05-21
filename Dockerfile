# ---- Base Stage (Common for Build and Dev) ----
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# Copy package.json and lockfile
COPY package.json bun.lock ./

# ---- Dependencies Stage (Installs all dependencies) ----
FROM base AS deps
# Install all dependencies (including devDependencies)
# This layer is cached and only rebuilds if package.json or bun.lockb changes
RUN bun install

# ---- Build Stage (Builds the application for production) ----
FROM deps AS build
# Copy the rest of your application code
COPY . .
# Run your build script (e.g., for TypeScript compilation, asset bundling)
# Example: 
RUN bun build --target=bun --outdir=./dist ./src/index.ts

# ---- Production Stage (Optimized for production) ----
# Use a slim image for production
FROM oven/bun:1-slim AS production 
WORKDIR /usr/src/app

# Set NODE_ENV to production
ENV NODE_ENV=production
# You can also set other production-specific environment variables here

# Copy production dependencies from the 'deps' stage
# This assumes bun install in 'deps' got everything needed for prod runtime,
# or you can run bun install --production here.
# A more robust way for production dependencies if 'deps' has devDeps:
# Create a dedicated 'prod-deps' stage that runs 'bun install --production'
# and copy from there. For simplicity in this example, we copy from 'deps'.
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/package.json ./package.json
COPY --from=deps /usr/src/app/bun.lock ./bun.lock

# Copy built application code from the 'build' stage
# Adjust this if your build step outputs to a specific directory (e.g., /dist)
# Assuming your build output is in 'dist'
COPY --from=build /usr/src/app/dist ./ 
COPY --from=build /usr/src/app/data ./data
# Or copy your source if running directly
# COPY --from=build /usr/src/app/src ./src 
# COPY --from=build /usr/src/app/tsconfig.json ./tsconfig.json

# Add a non-root user and switch to it
# RUN groupadd --gid 1001 bunuser && \
#     useradd --uid 1001 --gid 1001 --shell /bin/bash --create-home bunuser
# USER bunuser

# Expose the port your app runs on
EXPOSE 3000

# Command to run your application in production
# Adjust 'dist/index.js' to your application's entry point
CMD ["bun", "index.js"]

# ---- Development Stage (Optimized for development) ----
# Start from the 'deps' stage which has all dependencies
# ---- Build Stage (Builds the application for production) ----
FROM deps AS compiled
# Copy the rest of your application code
COPY . .
# Run your build script (e.g., for TypeScript compilation, asset bundling)
# Example: 
RUN bun build --compile --outdir=./dist ./src/index.ts

FROM gcr.io/distroless/cc-debian12 AS final
WORKDIR /app

COPY --from=compiled /usr/src/app/dist/my-app ./my-app

EXPOSE 3000

# ---- Development Stage (Optimized for development) ----
# Start from the 'deps' stage which has all dependencies
FROM deps AS development 
WORKDIR /usr/src/app

# Copy the rest of your application code (can be mounted as a volume in dev)
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Command to run your application in development (e.g., with hot-reloading)
# Bun's native watch mode is often sufficient:
CMD ["bun", "--watch", "src/index.ts"]
# Or if you have a specific dev script:
# CMD ["bun", "run", "dev"]
