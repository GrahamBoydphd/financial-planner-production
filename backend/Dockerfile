# --- Stage 1: Builder ---
FROM rust:latest as builder

WORKDIR /app

# Enable SQLx Offline Mode
ENV SQLX_OFFLINE=true

# 1. Download dependencies
COPY Cargo.toml Cargo.lock ./
# Create dummy src
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# 2. Build the actual source code
COPY . .
# Touch main.rs to force a rebuild
RUN touch src/main.rs
RUN cargo build --release

# --- Stage 2: Runtime ---
FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

# FIXED: Copy the binary named 'backend', not 'financial_simulation_backend'
COPY --from=builder /app/target/release/backend ./backend
COPY --from=builder /app/migrations ./migrations

EXPOSE 8000

CMD ["./backend"]

