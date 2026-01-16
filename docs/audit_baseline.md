I have analyzed the attached files and cross-referenced them with the project's evolution. Below is the **Master Context Freeze** for the MVP. This document represents the "Definitive Truth" of the system as it stands before any User Layer modifications.
This is the audit baseline.

### **MASTER CONTEXT FREEZE (MVP)**

**Status:** Stable Core | **Version:** 1.0 (Pre-Auth) | **Target:** Single-User Simulation

#### **1. VALIDATION & DRIFT CORRECTION**

* **The "Double API" Drift:** The docs imply `NEXT_PUBLIC_API_URL` should include `/api`.
* **CORRECTION:** The frontend client (`auth-client.ts`) points to the **Root** (`http://localhost:8000`), and the API library (`api.ts`) appends `/api/...`. This prevents the `api/api/funds` error.


* **Docker Compose Syntax:** Old docs reference `docker-compose` (hyphen).
* **CORRECTION:** We successfully migrated to **Docker Compose V2**. The strict syntax is `docker compose` (space).


* **Caddy Routing:**
* **TRUTH:** Caddy is the **only** entry point in production (Ports 80/443). The Backend (Port 8000) and Frontend (Port 3000) are hidden behind it and strictly bound to internal networks.


* **Deployment Script:**
* **TRUTH:** We moved away from manual `git pull` on the server. The workflow is strictly `deploy.sh` (Local Build & Push)  `trigger-update.sh` (Remote Pull & Restart).



#### **2. THE "HIDDEN" RULES (Implicit Conventions)**

* **Math Precision:** All currency calculations in Rust MUST use `rust_decimal::Decimal`. Floating point (`f64`) is strictly forbidden for financial values to prevent rounding drift.
* **Frontend-Backend Contract:**
* **IDs:** The Frontend treats all IDs as Strings, but the Backend enforces `uuid::Uuid`. The Frontend **must not** attempt to generate IDs; it lets the DB generate them and reads them back.
* **Error Handling:** The Backend returns `Result<Json<T>, AppError>`. We do not return raw `500` strings; we return structured JSON errors that the Frontend intercepts.


* **"Smart Client" Pattern:**
* We do **not** use raw `axios` or `fetch` in UI components. All calls must go through `lib/api.ts`, which wraps the configured `auth-client` instance. This centralizes base URL logic.



#### **3. INFRASTRUCTURE CONFIGURATION**

| Feature | **Laptop (Dev)** | **Server (Production)** |
| --- | --- | --- |
| **Domain** | `localhost` | `planner.evolutesix.com` |
| **Entry Point** | Direct (Port 3000 FE, 8000 BE) | **Caddy** (Ports 80/443) |
| **Database Host** | `localhost` (Docker mapped) | `127.0.0.1` (Host Bound) |
| **API URL (Env)** | `http://localhost:8000` | `https://planner.evolutesix.com` (Note: No `/api` suffix) |
| **Container Strategy** | `docker-compose.yml` (Dev Mode) | `docker-compose.prod.yml` (Production Mode) |
| **Secrets** | `.env` (Local) | `~/app/.env` (Server) |

#### **4. KNOWN TECHNICAL DEBT (The "Fix Later" List)**

* **Hardcoded "Legacy" Tenant:**
* To make the MVP work before Auth, we created a migration that sets a default `tenant_id = 'system_legacy'` for all rows. This logic is currently hardcoded in the migration SQL.
* *Action:* This must be removed/refactored when strict Auth is fully live.


* **"Ghost File" Risk:**
* The Next.js App Router has a tendency to cache dynamic routes aggressively.
* *Workaround:* We use `scripts/clean-slate.sh` to nuke the `.next` folder and `app/` subfolders when routes get stuck.


* **Migration Buffer Issue:**
* Pasting large SQL files into the terminal via `cat << EOF` corrupts the text.
* *Workaround:* We strictly use Python scripts (`apply.py`) or `nano` to write SQL files.



This document is your **Master Anchor**. Any code that contradicts this is a regression.
