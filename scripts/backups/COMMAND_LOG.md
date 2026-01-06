# Command Log & Server Maintenance

## 1. Local Laptop Commands
| Command | Purpose |
| :--- | :--- |
| `git add .` | Stage all changes (new files and edits). |
| `git commit -m "msg"` | Save changes to history. |
| `git push origin cloud-v1-release` | Send code to GitHub. |

## 2. Server Commands (Production)
*Log in first:* `ssh root@51.15.117.59`

### A. Deployment & Updates
| Command | Purpose |
| :--- | :--- |
| `./clean_rebuild.sh all` | **The Golden Command.** Rebuilds and restarts everything securely. |
| `git pull origin cloud-v1-release` | Downloads new code (run before rebuilding). |
| `git stash` | Hides local changes if git pull fails. |

### B. Logs & Debugging (Modern Docker Syntax)
| Command | Purpose |
| :--- | :--- |
| `docker compose logs -f caddy` | View Web Server logs (Traffic, SSL errors). |
| `docker compose logs -f backend` | View App API logs (Rust errors). |
| `docker compose ps` | Check status of all containers. |
| `nano .env` | Edit environment variables (API URLs, Passwords). |

### C. System Maintenance & Security
| Command | Purpose |
| :--- | :--- |
| `systemctl status docker` | Check if the Docker Engine is running. |
| `ufw status` | Check Firewall rules (Should allow 22, 80, 443 only). |
| `ufw allow <port>` | Open a port (Use with caution). |
| `shutdown -h now` | Turn off server to save money (IP remains static). |

## 3. Automation Scripts
**`deploy.sh`** (Create this on Server to save time)
```bash
#!/bin/bash
echo "⬇️ Pulling latest code..."
git stash
git pull origin cloud-v1-release
echo "🚀 Rebuilding..."
./clean_rebuild.sh all
