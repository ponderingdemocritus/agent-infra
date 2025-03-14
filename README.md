# Chairman DAO

A Discord bot powered by Daydreams AI with deep research capabilities.

## Environment Setup

Copy the `.env.example` file to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

Then edit the `.env` file with your actual API keys.

## Running with Docker

This project includes Docker configuration for easy setup and deployment.

### Prerequisites

- Docker
- Docker Compose

### Starting the Application

To start the application and ChromaDB:

```bash
docker-compose up -d
```

This will:

1. Build the application Docker image
2. Start ChromaDB (accessible at http://localhost:8001)
3. Start the Discord bot

### Viewing Logs

To view the logs (stream) of your containers:

```bash
# View logs from all containers
docker-compose logs -f

# View logs from a specific container
docker-compose logs -f app     # For the application container
docker-compose logs -f chromadb  # For the ChromaDB container
```

The `-f` flag follows the log output in real-time, similar to `tail -f`.

To run the containers in the foreground and see logs directly in your terminal:

```bash
# Remove the -d flag to run in foreground
docker-compose up
```

### Port Configuration

By default, ChromaDB is configured to use port 8001 on the host machine (mapped to port 8000 inside the container). If port 8001 is also in use, you can modify the `docker-compose.yml` file to use a different port:

```yaml
chromadb:
  # ... other configuration ...
  ports:
    - "YOUR_PREFERRED_PORT:8000"
```

Note that the application container will still connect to ChromaDB using the internal Docker network at `http://chromadb:8000`.

### Troubleshooting

#### ChromaDB Connection Issues

If you see errors like `SyntaxError: Unexpected end of JSON input` in the logs, it might be due to ChromaDB not being fully initialized when the app tries to connect to it. The application includes a retry mechanism and a startup script that waits for ChromaDB to be ready, but you can also try these steps:

1. Check if ChromaDB is running properly:

   ```bash
   docker-compose exec chromadb curl http://localhost:8000/api/v1/heartbeat
   ```

   This should return a response if ChromaDB is running correctly.

2. Restart the containers with a clean slate:

   ```bash
   docker-compose down
   docker-compose up -d
   ```

3. Check the ChromaDB logs for any errors:

   ```bash
   docker-compose logs chromadb
   ```

4. If problems persist, try rebuilding the containers with no cache:

   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

5. For persistent issues, you can try resetting ChromaDB:

   ```bash
   # Stop the containers
   docker-compose down

   # Remove the ChromaDB volume
   docker volume rm chairman_chroma-data

   # Start the containers again
   docker-compose up -d
   ```

#### TextDecoderStream Error

If you encounter an error like `ReferenceError: Can't find variable: TextDecoderStream`, it's related to missing web stream APIs in the Bun environment. The application includes polyfills for these APIs, but if you still encounter issues:

1. Make sure you're using the latest version of the application with the polyfills
2. Rebuild the containers with no cache:
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```
3. Check the logs to see if the polyfills are loaded successfully:
   ```bash
   docker-compose logs app | grep "polyfills loaded"
   ```

### Stopping the Application

To stop all services:

```bash
docker-compose down
```

To stop and remove volumes (this will delete ChromaDB data):

```bash
docker-compose down -v
```

## Development

For local development without Docker:

```bash
# Install dependencies
bun install

# Start the application
bun run index.ts
```

Note: For local development, you'll need to have ChromaDB running separately or update the CHROMADB_URL in your .env file to point to your ChromaDB instance.

This project was created using `bun init` in bun v1.2.4. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
