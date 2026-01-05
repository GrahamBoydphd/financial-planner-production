# --- Stage 1: Builder ---
FROM rust:1.81-slim-bullseye as builder

WORKDIR /app

# 1. Download dependencies (this layer is cached if Cargo.toml doesn't change)
COPY Cargo.toml Cargo.lock ./
# Create dummy src to trick cargo into building just dependencies
mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# 2. Build the actual source code
COPY . .
# Touch main.rs to force a rebuild of the code, not just deps
RUN touch src/main.rs
RUN cargo build --release

# --- Stage 2: Runtime ---
FROM debian:bullseye-slim

WORKDIR /app

# Install necessary system libraries (SSL, etc.)
RUN apt-get update && apt-get install -y libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy the binary from the builder stage
COPY --from=builder /app/target/release/financial_simulation_backend ./backend
COPY --from=builder /app/migrations ./migrations

# Expose the port
EXPOSE 8000

# Run the binary
CMD ["./backend"]
