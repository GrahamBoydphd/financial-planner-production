# Production Deployment & Workflow Learnings
**Objective:** Capture "Gotchas" to avoid repeating mistakes. Minimise time shifting from Dev to Prod for future modules.

### 10. Critical: Frontend Build Variables
* **The Trap:** \`NEXT_PUBLIC_\` variables are baked into the code at **Build Time**.
* **The Risk:** If you build the production Docker image while \`NEXT_PUBLIC_API_URL\` is set to \`localhost\`, the live site will try to contact the *user's computer* and fail.
* **The Fix:** On the production server, ensure the \`.env\` file has \`NEXT_PUBLIC_API_URL=https://planner.evolutesix.com/api\` **before** running the build command.

### 9. The "Shell Paste" Trap (File Corruption)
* **The Issue:** Attempting to write large SQL migration files using `cat << EOF` pasted into a terminal buffer often fails. The shell cuts off the text mid-stream, resulting in broken SQL syntax or missing commands.
* **The Fix:** 1. **Python Script:** Use a small Python script to write strings to disk (safer buffering).
    2. **Nano:** For critical files, use `nano filename` and paste directly into the editor.
    3. **Verification:** Always run `tail -n 5 filename` after pasting to ensure the end of the file exists.

### 8. The "Orphan Container" Trap
* **The Issue:** `docker compose up` defaulting to the wrong YAML file causing "No services to build".
* **The Fix:** Explicitly specify `-f docker-compose.prod.yml`. Use `--remove-orphans` to clean up.

### 7. Security: The "Distinct Key" Strategy
* **Rule:** Separate keys for GitHub vs. Server Access. Never forward personal agent keys to production.

### 6. Git-Based Deployment
* **Rule:** "Pull & Build" on the server is safer/easier than pushing Docker images from a laptop.

---

### 2. Updated `PRODUCTION_LEARNINGS.md`
This version captures the critical lessons from the Caddy, Docker V2, and Firewall implementation.

```markdown
# Production Deployment Learnings
**Objective:** Minimise time shifting from Dev to Prod for future modules.

## 1. Environment Variables & Build Strategy
* **The Issue:** Changing `.env` variables (like API URLs) didn't update the running app.
* **The Fix:** Frontend variables (`NEXT_PUBLIC_`) are baked in at **Build Time**. You must run `docker compose build --no-cache frontend` to apply changes.
* **The Improvement:** We now use a Domain (`planner.evolutesix.com`) instead of a fragile IP address, so we rarely need to change this variable anymore.

## 2. Network & Routing (Caddy Implementation)
* **The Old Way:** App exposed on ports 3000/8000. Required complex URL logic.
* **The New Way:** **Caddy Reverse Proxy**.
    * **Single Entry Point:** Ports 80/443 (Standard Web).
    * **Auto-Routing:** Caddy sends `/api/*` to Backend and `*` to Frontend.
    * **Benefit:** Fixes CORS issues and creates cleaner API calls.
* **Lesson:** Always use a Reverse Proxy in production; never expose App ports directly.

## 3. Docker Infrastructure
* **The Issue:** Legacy `docker-compose` (Python) crashed with `KeyError` on modern images.
* **The Fix:** Upgraded to **Docker Compose V2** (Go-based plugin).
* **Syntax Change:** Commands are now `docker compose` (space), not `docker-compose` (hyphen).

## 4. Security & Firewalling
* **The Risk:** Database port 5432 was open to the internet.
* **The Fix (Layer 1):** UFW Firewall blocks all non-web ports.
* **The Fix (Layer 2):** Database service explicitly bound to `127.0.0.1:5432` in Docker config.
* **Lesson:** Database ports should never be mapped globally (`0.0.0.0`) in production.

## 5. Workflow Discipline
* **The Rule:** "Build Local -> Deploy Prod".
* **Why:** Testing on the server ("Hotfixing") creates git conflicts and breaks the deployment pipeline.
* **Action:** If a bug is found on Prod, reproduce it Locally, fix it, push it, and deploy.

---

### 1. `PRODUCTION_LEARNINGS.md`
From the first session

## 1. Frontend Environment Variables are "Baked In"
* **The Issue:** Changing `.env` on the server did not update the frontend API URL.
* **The Lesson:** Next.js (`NEXT_PUBLIC_`) variables are replaced **at build time**, not run time.
* **The Fix:**
    1.  We must define `args` in the `docker-compose.prod.yml` `build` section.
    2.  We must run `docker-compose build --no-cache` when changing these variables.

## 2. The "Double Slash" Trap
* **The Issue:** API requests failed with `404` because URLs looked like `...:8000//api/funds`.
* **The Lesson:** Concatenating URLs is fragile.
* **The Standard:**
    * **Base URL (Env):** Never include a trailing slash (`http://host:port`).
    * **Base URL (Env):** Never include the path (`/api`) if the code appends it.
    * **Client Code:** Always append paths starting with a slash (`/api/funds`).

## 3. Server-Side "Hotfixes" create Conflicts
* **The Issue:** We edited `api.ts` on the server to test IPs. This caused `git pull` to fail later.
* **The Lesson:** The server is "Read Only." If a bug exists, fix it locally, push, and pull. If you must hack on the server, revert changes (`git checkout .` or `git stash`) immediately after testing.

## 4. Legacy Docker Compose
* **The Issue:** The server runs `docker-compose` v1.29, which crashed with `KeyError: 'ContainerConfig'` when reading newer Postgres images.
* **The Fix:** We had to manually `docker rm` the container to force a fresh creation.
* **Future Prevention:** Upgrade server to Docker Compose v2 (see tomorrow's tasks).

## 5. Deployment Scripting
* **The Lesson:** Typing 4 docker commands to rebuild is prone to error (forgetting `--no-cache`).
* **The Fix:** We created `clean_rebuild.sh`. **Always use scripts for deployment actions.**
