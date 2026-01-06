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
