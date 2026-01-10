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

| Command                                                       | Location | Purpose                                           |
| :------------------------------------------------------------ | :------- | :------------------------------------------------ |
| `ssh -i ~/.ssh/jules_bp_key root@51.15.117.59`                | Laptop   | Log into the server securely.                     |
| `cd ~/app`                                                    | Server   | Go to project folder.                             |
| `docker compose -f docker-compose.prod.yml logs -f --tail=50` | Server   | View live logs for all services (Backend/Caddy).  |
| `docker stats`                                                | Server   | Check if RAM is full (Rust compilation is heavy). |

## 3. One-Time Setup Commands (Reference)
These were used to set up the environment and are rarely needed now.

* **Generate SSH Key:** `ssh-keygen -t ed25519 -C "deploy_key"`
* **Check Caddyfile:** `cat ~/app/Caddyfile`
* **Update Server Env:** `nano ~/app/.env` (Remember to restart containers after editing).


## 1. Authentication Testing (Manual)
Since we have a secure API, we often need `curl` to verify things before the UI is ready.

### A. Login (Get Token)
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "admin@evolutesix.com", "password": "SecurePassword123!" }'
```
*Response:* `{"token": "eyJ..."}`

### B. Use Token (The "Bearer" Header)
```bash
export TOKEN="paste_token_here"

curl -i -X GET http://localhost:8000/api/companies \
  -H "Authorization: Bearer $TOKEN"
```

### C. Create Tenant & Admin (First Run)
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "new@company.com",
    "password": "Password123",
    "full_name": "Founder Name",
    "company_name": "New Startup Ltd"
  }'
```

## 2. Dev Environment
* **Generate JWT Secret:** `openssl rand -base64 32`
* **Run Backend:** `cd backend && cargo run`
* **Run Migrations:** `cd backend && sqlx migrate run`
* **Reset Database (Extreme):** `cd backend && sqlx database reset -y`

## 3. Production Deployment
* **Trigger Update:** `./scripts/trigger-update.sh` (Run from Laptop)
* **Manual Server Check:** `docker compose -f docker-compose.prod.yml logs -f`

## 4. Creating files
* The printf approach is much more robust against shell copy-paste quirks than cat << EOF

## 5. git
* git branch
* The Fix: Discard the "Clean Slate" Changes
Since the "real" code is safe in the git commit you just reset to (9504b3d), we just need to tell git to throw away the changes on your disk and restore the files from the repository.

Run this command in your project root:

Bash

git checkout .
What this does: It looks at every modified file (the ones clean-slate.sh broke) and reverts them to the state of the HEAD commit (9504b3d).

Result: Your tables, forms, and buttons will reappear instantly. 
# 1. Create and switch to the new feature branch
git checkout -b feature/user-layer-v2

# 2. Stage all the files (docs & fixes) you restored
git add .

# 3. Commit them to save your starting point
git commit -m "chore: Restore architectural context and docs for User Layer v2 start"
# 1. "Rename" current state to your new feature branch
git checkout -b feature/user-layer-v2

# 2. Stage the documentation and restored files
git add .

# 3. Save them as the "Starting Point" for this feature
git commit -m "chore: Restore architectural context and docs for User Layer v2 start"

# 1. Update map
git fetch origin

# 2. Compare Current Spot vs. GitHub's version
git diff HEAD...origin/cloud-v1-release

```
git status
```

- **If it says `HEAD detached at 9504b3d`:** You are floating. You definitely want to create your new branch now to "save" this spot.
    
- **If it says `On branch cloud-v1-release`:** You are on the release branch.

### The Correct, Safe Sequence

**1. Save your work (Commit)** Do this _before_ moving. This saves the AI's changes into the current `ai-fix` branch.

Bash

```
git add .
git commit -m "Implement Auth Handlers (AI)"
```

**2. Switch to the target** Now move to your main feature branch.

Bash

```
git checkout feature/user-layer-v2
```

**3. Update the target** Since you just made a new commit in step 1, your `feature` branch is now one step behind. Pull that commit in.

Bash

```
git merge ai-fix-20260110124148
```

_(Note: Use the branch name you were just on. You can find it with `git branch` if you forgot)._

**4. The Great Purge** Now that `feature/user-layer-v2` has everything safely committed, kill the clutter.

Bash

```
git branch | grep "ai-fix-" | xargs git branch -D
```

**Now you are clean, saved, and on the right branch.**





## SQLX
**Command :** `sqlx migrate add <DESCRIPTION>` **Resulting File:** `migrations/<TIMESTAMP>_<DESCRIPTION>.sql`

### Example

1. **You run:**
    
    Bash
    
    ```
    sqlx migrate add create_users_table
    ```
    
2. **The Tool creates:**
    
    Plaintext
    
    ```
    backend/migrations/20260109130000_create_users_table.sql
    ```