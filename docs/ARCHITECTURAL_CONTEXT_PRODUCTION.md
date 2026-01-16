# Architectural Context: Production Environment
**Date:** January 6, 2026
**Status:** Live / Production
**URL:** https://planner.evolutesix.com
**Infrastructure:** Scaleway VPS + Docker Compose V2 + Caddy

## 1. System Architecture
* **Reverse Proxy:** Caddy (Auto-HTTPS).
    * Routes `planner.evolutesix.com` -> Frontend
    * Routes `planner.evolutesix.com/api/*` -> Backend
* **Frontend:** Next.js (Node container).
* **Backend:** Rust API (Compiled on Server).
* **Database:** PostgreSQL 15 (Bound to 127.0.0.1).

## 2. Environment & Configuration
* **Public Domain:** `planner.evolutesix.com`
* **Server IP:** `51.15.117.59`
* **File Structure (Server):**
    * `~/app/` : Root project folder.
    * `~/app/.env` : Production secrets (POSTGRES_PASSWORD, DATABASE_URL).
    * `~/app/Caddyfile` : Routing configuration.
    * `~/app/docker-compose.prod.yml` : Production definition.

## 3. Operational Commands
* **Primary Deployment:** Run `./scripts/trigger-update.sh` from your **Laptop**.
* **Manual Rebuild (Server-side fallback):**
    ```bash
    cd ~/app
    git pull origin cloud-v1-release
    docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
    ```
