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
