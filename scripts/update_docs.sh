#!/bin/bash

echo "📝 Updating Documentation Files..."

# ------------------------------------------------------------------
# 1. ARCHITECTURAL_CONTEXT.md
# Updated Section 3 to focus on Dashboard/UI
# ------------------------------------------------------------------
cat << 'EOF' > ARCHITECTURAL_CONTEXT.md
# ARCHITECTURAL_CONTEXT.md
# Current Status: BUILD PHASE - UI & VISUALIZATION
# Last Updated: January 6, 2026

## 1. PROJECT GOAL
**Objective:** Build a financial simulation engine capable of non-ergodic (Monte Carlo) analysis for startups.
**Core Philosophy:** Avoid "average of averages." Simulate path-dependent volatility using specific distributions (Normal, Student's T, NRIG).

## 2. ESTABLISHED CONSTRAINTS (DO NOT CHANGE)
* **Tech Stack:**
    * **Backend:** Rust (Axum, SQLx, Tokio).
    * **Database:** PostgreSQL (SQLx for compile-time checked queries).
    * **Frontend:** Next.js (TypeScript, React, Tailwind CSS).
    * **Math:** `rust_decimal` for all currency calculations. No floating point money.
* **Core Engine (`backend/src/projection.rs`):**
    * The simulation loop calculates month-by-month cash flow.
    * It handles: Revenue, COGS, OpEx, Capital Injections, Dividends, and Credit Facilities.
    * **Monte Carlo:** Runs 1000+ iterations if enabled, calculating percentiles (P5, P50, P95).
    * **Logic:** Insolvency logic stops simulation if cash < -credit_limit.
* **Visualization:**
    * Fan Charts (`CashFlowChart.tsx`) visualize the P5-P95 spread.
    * Supports both Logarithmic and Linear scales.

## 3. CURRENT FOCUS: USER INTERFACE & DASHBOARD
**Task:** Build the interactive frontend layer that allows Founders to configure and view simulations.

### A. Dashboard Layout (Next.js)
* **Goal:** Create a professional, clean layout using Tailwind CSS.
* **Structure:** * **Sidebar:** Navigation (Simulations, Saved Scenarios, Settings).
    * **Main Canvas:** Where charts and data tables reside.
    * **Control Panel:** Collapsible or persistent panel for tweaking simulation parameters (Volatility, Drift, Starting Cash).

### B. Simulation Inputs (Forms)
* **Requirement:** Type-safe forms to feed the `projection.rs` engine.
* **Key Inputs:** * Initial Capital & Burn Rate.
    * Distribution Settings (Normal vs. Fat-tailed/Cauchy).
    * Monthly adjustments (One-off costs vs. Recurring).

## 4. NEXT UP (PENDING)
* User Authentication (Login/Signup).
* PDF Export of Simulation Results.
EOF
echo "✅ ARCHITECTURAL_CONTEXT.md updated."

# ------------------------------------------------------------------
# 2. PRODUCTION_LEARNINGS_V1.md
# Added "Distinct Keys", "Git Workflow", and "Orphan Containers"
# ------------------------------------------------------------------
cat << 'EOF' > PRODUCTION_LEARNINGS_V1.md
# Production Deployment Learnings
**Objective:** Minimise time shifting from Dev to Prod for future modules.

### 6. Security: The "Distinct Key" Strategy
* **The Issue:** Using a single SSH key for everything (GitHub, Personal Access, Server Access) is a security risk.
* **The Fix:** We use **Distinct Keys** for every boundary.
    * **Laptop -> GitHub:** Personal SSH Key.
    * **Laptop -> Server:** A dedicated IdentityFile (`~/.ssh/jules_bp_key`) specified in the trigger script.
    * **Server -> GitHub:** A "Deployment Key" (Read-Only) added to the Repo settings.
* **Lesson:** Never forward your personal agent to a production server. Give the server its own distinct identity.

### 7. Git-Based Deployment Pipeline
* **The Old Way:** Building Docker images locally and pushing to a Registry (Slow upload, requires API keys).
* **The New Way:** **"Pull & Build"**.
    1.  Laptop Pushes Code -> GitHub.
    2.  Laptop runs `trigger-update.sh`.
    3.  Server Pulls Code -> Recompiles Rust -> Restarts Containers.
* **Benefit:** Simpler credential management. No need for Scaleway API keys on the laptop.

### 8. The "Orphan Container" Trap
* **The Issue:** The server deployment failed with `No services to build` because `docker compose up` defaulted to the wrong file (`docker-compose.yml` vs `docker-compose.prod.yml`).
* **The Fix:** Explicitly specify the file in the deployment command: `docker compose -f docker-compose.prod.yml up ...`
* **The Cleanup:** Use the `--remove-orphans` flag to automatically kill old containers that don't match the new configuration.

---
*(Previous learnings 1-5 retained below for reference)*

## 1. Environment Variables & Build Strategy
* **The Fix:** Frontend variables (`NEXT_PUBLIC_`) are baked in at **Build Time**. Must run `docker compose build --no-cache frontend` to apply changes.

## 2. Network & Routing (Caddy Implementation)
* **The Lesson:** Always use a Reverse Proxy (Caddy) in production. Never expose App ports (3000/8000) directly.

## 3. Docker Infrastructure
* **The Fix:** Upgrade to **Docker Compose V2**. Syntax is `docker compose` (no hyphen).

## 4. Security & Firewalling
* **The Lesson:** Database ports (5432) should never be mapped globally (`0.0.0.0`) in production. Bind to `127.0.0.1`.

## 5. Workflow Discipline
* **The Rule:** "Build Local -> Deploy Prod". Never "hotfix" on the server.
EOF
echo "✅ PRODUCTION_LEARNINGS_V1.md updated."

# ------------------------------------------------------------------
# 3. COMMAND_LOG.md
# Updated to reflect the "trigger-update.sh" workflow
# ------------------------------------------------------------------
cat << 'EOF' > COMMAND_LOG.md
# Command Log & Maintenance

## 1. The Deployment Workflow (Routine)
**Goal:** Deploy local changes to `planner.evolutesix.com`.

| Step | Location | Command | Purpose |
| :--- | :--- | :--- | :--- |
| 1 | Laptop | `git add . && git commit -m "msg"` | Save changes. |
| 2 | Laptop | `git push origin cloud-v1-release` | Upload to GitHub. |
| 3 | Laptop | `./scripts/trigger-update.sh` | **Magic Button.** Triggers the server to pull & rebuild. |

## 2. Debugging (If Deployment Fails)
**Goal:** Check why the site is down.

| Command | Location | Purpose |
| :--- | :--- | :--- |
| `ssh -i ~/.ssh/jules_bp_key root@51.15.117.59` | Laptop | Log into the server securely. |
| `cd ~/app` | Server | Go to project folder. |
| `docker compose -f docker-compose.prod.yml logs -f --tail=50` | Server | View live logs for all services (Backend/Caddy). |
| `docker stats` | Server | Check if RAM is full (Rust compilation is heavy). |

## 3. One-Time Setup Commands (Reference)
These were used to set up the environment and are rarely needed now.

* **Generate SSH Key:** `ssh-keygen -t ed25519 -C "deploy_key"`
* **Check Caddyfile:** `cat ~/app/Caddyfile`
* **Update Server Env:** `nano ~/app/.env` (Remember to restart containers after editing).
EOF
echo "✅ COMMAND_LOG.md updated."

# ------------------------------------------------------------------
# 4. ARCHITECTURAL_CONTEXT_PRODUCTION.md
# Updated operational commands
# ------------------------------------------------------------------
cat << 'EOF' > ARCHITECTURAL_CONTEXT_PRODUCTION.md
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
EOF
echo "✅ ARCHITECTURAL_CONTEXT_PRODUCTION.md updated."

echo "🎉 All documentation updated to match the new Deployment Pipeline."
