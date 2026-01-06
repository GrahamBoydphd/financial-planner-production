# Architectural Context: Production Environment
**Date:** January 6, 2026
**Status:** Live / Production
**URL:** https://planner.evolutesix.com
**Infrastructure:** Scaleway VPS + Docker Compose + Caddy

## 1. System Architecture
* **Reverse Proxy:** Caddy (Auto-HTTPS).
    * Routes `planner.evolutesix.com` -> Frontend
    * Routes `planner.evolutesix.com/api/*` -> Backend
* **Frontend:** Next.js (Node container).
    * Internal Port: 3000 (Not exposed publicly).
* **Backend:** Rust API.
    * Internal Port: 8000 (Not exposed publicly).
* **Database:** PostgreSQL 15.
    * Internal Port: 5432 (Bound to 127.0.0.1 only).

## 2. Environment & Configuration
* **Public Domain:** `planner.evolutesix.com`
* **Server IP:** `51.15.117.59` (Used for SSH and DNS A-Record).
* **Environment Variables:**
    * `NEXT_PUBLIC_API_URL`: `https://planner.evolutesix.com` (No port, no trailing slash).
    * *Note:* This variable is BAKED IN at build time. If changed, must run `./clean_rebuild.sh frontend`.

## 3. Operational Commands
* **Deploy/Update:** `./clean_rebuild.sh all`
* **Logs (Web Server):** `docker compose -f docker-compose.prod.yml logs -f caddy`
* **Logs (App):** `docker compose -f docker-compose.prod.yml logs -f backend`
