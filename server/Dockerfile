# Stage 1: Build the Go binary
FROM golang:1.23 AS builder

# Set the Current Working Directory inside the container
WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies. Dependencies will be cached if the go.mod and go.sum files are not changed
RUN go mod download

# Copy the source code into the container
COPY . .

# Build the Go app - Creates a static binary
# Use CGO_ENABLED=0 for a static binary suitable for minimal base images like alpine
# GOOS=linux is important as GKE nodes run Linux
RUN CGO_ENABLED=0 GOOS=linux go build -v -o chairman-server .

# Stage 2: Create the final, minimal image
FROM alpine:latest

# Set the Current Working Directory inside the container
WORKDIR /app

# Copy the Pre-built binary file from the previous stage
COPY --from=builder /app/chairman-server .

# Expose port 8000 to the outside world
EXPOSE 8000

# Command to run the executable when the container starts
# The flags will be passed via the Kubernetes Deployment manifest later
CMD ["./chairman-server"]