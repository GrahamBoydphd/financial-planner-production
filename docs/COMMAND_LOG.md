# Command Log & Maintenance

`tree -I 'node_modules|.next|target|.sqlx|.git|*.log|*.bak|*.p.woff2|*.pack*|*.hot-update.*|__pycache__|.stfolder|.stversions|.obsidian|.trash' > a_tree.txt`


# 3.5 do_task.sh upgrade
### 🏎️ How to Shift Gears

- **The Default (Heavy Architectural Work, defaults to 3.1 pro):**
    
    Bash
    
    ```
    ./scripts/do_task.sh "Build the new ERG simulation engine" backend/src/engine.rs
    ```
    
- **The Fast Lane (Simple UI fixes, typos, small scripts):**
    
    Bash
    
    ```
    ./scripts/do_task.sh -m gemini-3.5-flash "Change button color to blue" frontend/components/Button.tsx
    ```


# 0. Coding Workflow
### Kill old running backends
sudo lsof -i :8000
sudo kill -9 2794

### Start Backend
cargo run
try_build.sh

### Start Frontend
npm run dev

Go to:   http://localhost:3000/


## 1. The Deployment Workflow (Routine)
**Goal:** Deploy local changes to `planner.evolutesix.com`.

| Step | Location | Command                                                                                                                                                                                                    | Purpose                                                                                                                           |     |
| :--- | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- | --- |
| 1    | Laptop   | `cargo sqlx prepare` (in backend)<br>npm run build (in frontend)<br>`git add . && git commit -m "msg"`<br>git status<br>git checkout branch_name e.g. feature/stage-4-architecture<br>git merge ai-fix-XXX | Save changes.                                                                                                                     |     |
| 2    | Laptop   | `git push origin feature/stage-4-architecture`                                                                                                                                                             | Upload to GitHub.                                                                                                                 |     |
| 3    | Laptop   | `./scripts/trigger-update.sh branch_name` e.g. feature/stage-4-architecture                                                                                                                                | **Magic Button.** Triggers the server to pull & rebuild.                                                                          |     |
|      |          | <br>`git checkout -`                                                                                                                                                                                       | If you just want to toggle back to the **previous** branch you were on (before you switched to the current one), simply type:<br> |     |
|      |          | `git branch --sort=committerdate`                                                                                                                                                                          | to see a list of branches, with the most recently changed one at the bottom                                                       |     |



## 2. Debugging (If Deployment Fails)
**Goal:** Check why the site is down.

| Command                                                       | Location | Purpose                                           |
| :------------------------------------------------------------ | :------- | :------------------------------------------------ |
| `ssh -i ~/.ssh/jules_bp_key root@51.15.117.59`                | Laptop   | Log into the server securely.                     |
| `cd ~/app`                                                    | Server   | Go to project folder.                             |
| `docker compose -f docker-compose.prod.yml logs -f --tail=50` | Server   | View live logs for all services (Backend/Caddy).  |
| `docker stats`                                                | Server   | Check if RAM is full (Rust compilation is heavy). |

# Deployment workflow V2
### 🛠️ The Deployment Command Registry

| **Category**             | **Command**                                                                                                                        | **Purpose**                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Git & Code**           | `git pull origin feature/user-layer-v2`                                                                                            | Syncs server code with your laptop's "Source of Truth."                  |
| **The "Nuclear" Option** | `docker compose -f docker-compose.prod.yml down -v`                                                                                | **Wipes everything.** Stops containers and deletes the DB volume.        |
| **Build & Launch**       | `docker compose -f docker-compose.prod.yml up -d`                                                                                  | Builds/Starts containers in the background (detached mode).              |
| **Build & Launch**       | `docker compose -f docker-compose.prod.yml build frontend`                                                                         | Forces a fresh compilation of the Next.js frontend code.                 |
| **Environment**          | `docker compose -f docker-compose.prod.yml up -d --force-recreate backend`                                                         | Forces the backend to "inhale" new `.env` changes.                       |
| **Migrations**           | `set -a && source .env && set +a`                                                                                                  | Loads `.env` variables into the current terminal session.                |
| **Migrations**           | `docker run --rm --network app_default -v "$(pwd)/backend/migrations:/migrations" -e DATABASE_URL="..." rust:latest bash -c "..."` | The "Toolbox" command to run migrations from outside the slim container. |
| **Verification**         | `docker compose -f docker-compose.prod.yml exec db psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c "\dt"`                            | Lists all database tables to verify migrations worked.                   |
| **Verification**         | `docker compose -f docker-compose.prod.yml exec backend env \| grep JWT`                                                           | Confirms the security "Pipe" is delivering the `JWT_SECRET`.             |
| **Monitoring**           | `docker compose -f docker-compose.prod.yml logs -f backend`                                                                        | Streams live logs (useful for debugging registration/login).             |
| **System Health**        | `docker stats`                                                                                                                     | Monitors CPU/RAM/Network usage of all running containers.                |

---

### 💡 Pro-Tip for the Future

Keep that **`docker-compose.prod.yml`** file in your Git repo exactly as we left it (with the `JWT_SECRET: ${JWT_SECRET}` mapping). As long as that "Pipe" exists in the YAML file and the "Value" exists in your server's `.env`, your deployments will be smooth from here on out.


To free up space on your production server, you should focus on cleaning up the build artifacts and temporary files generated during the Docker and Rust compilation processes.

### 🗑️ Target Areas for Cleanup

df -h for the usage

A quick reference of the "space-hogs" you can target immediately:

- **Docker Builder Cache:** `docker builder prune` is often the most effective way to clear the gigabytes of temporary data generated by repeated `cargo build` attempts inside your Dockerfiles.
    
- **Dangling Images:** Use `docker images -f "dangling=true" -q | xargs docker rmi` to surgically remove the "ghost" images left over from the 500 error and build failure cycles.
    
- **The `.next` Folder:** On the server, `frontend/.next` can grow quite large. If you are doing a fresh build, `rm -rf ~/app/frontend/.next` before the next deploy will ensure no legacy chunks are sitting in your storage.

#### 1. Rust Build Artifacts (Target Directories)

The `target/` directory in a Rust project can grow significantly, especially after multiple release builds. Since your production environment builds inside Docker containers, you likely have redundant `target/` folders on the host machine.

- **Action**: Locate any `target/` directories in your project folders and delete them.
    
- **Command**: `rm -rf ~/app/backend/target`
    

#### 2. Docker System Cleanup

Docker often leaves behind "dangling" images (unused layers from previous builds) and stopped containers that consume gigabytes of space.

- **Dangling Images**: `docker image prune`

# BIG ONE
- **All Unused Objects**: `docker system prune -a` (This deletes all stopped containers, unused networks, and images without at least one container associated with them).
    
- **Volumes**: `docker volume prune` (Use with caution; ensure you aren't deleting persistent database volumes).
    

#### 3. SQLx Temporary Files

During the "Fortress" hardening, you generated multiple `.sqlx` files and temporary schema dumps.

- **Action**: Remove the `schema.sql` file created during our recent troubleshooting.
    
- **Command**: `rm ~/app/schema.sql`
    

#### 4. Old Backups and Logs

Your file tree shows a `scripts/backups/` directory containing various older scripts and context files.

- **Action**: Review and remove outdated files in `~/app/scripts/backups/`.
    
- **Log Files**: Check for large `.log` files in the `frontend/` or `backend/` directories, such as `frontend.log` or `last_error.log`.
    

#### 5. System Package Cache

Since you recently updated the server, the `apt` cache may contain unnecessary package files.

- **Command**: `sudo apt-get clean` and `sudo apt-get autoremove`


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

## Deleting an erroneously created database sql file's outcomes:
Delete file, and then do: `docker-compose exec db psql -U postgres -d finance_db_local -c "DELETE FROM _sqlx_migrations WHERE version = 20240522000000;"`
Success if it says DELETE 1



### Look at all the sql files by cat-ting them into one: 
`for f in migrations/*.sql; do echo "${f%.*}"; cat "$f"; done >all_sql.log`
 




# New Version: Backup directory and clean it.
### 1. Create the Backup Directory

From your laptop terminal, stay in the parent directory of your project and use `cp -r` (recursive copy).

Bash

```
cd ~/3_Evolutesix/Research/Jules-BP/
# Create a timestamped backup folder
cp -r current/ current_V3_Frozen_Backup_20260120/
```

---

### 2. The "Weight Loss" Plan (Cleanup)

We want to remove the three main "space-eaters" that are not part of your actual source code:

1. **`node_modules`**: The external JavaScript libraries (~500MB+).
    
2. **`target/`**: The Rust compilation artifacts (~1GB+).
    
3. **`.next/`**: The Next.js build cache (~100MB+).
    

**Run these commands inside your new backup directory:**

Bash

```
cd current_V3_Frozen_Backup_20260120/

# Remove Frontend heavy files
rm -rf frontend/node_modules
rm -rf frontend/.next

# Remove Backend heavy files
rm -rf backend/target
rm -f backend/backend.log

# Remove any hidden OS junk or temp files
find . -name ".DS_Store" -delete
```

---

### 3. Verify the Backup Size

To ensure the backup is lean and strictly contains your source code, check the size:

Bash

```
du -sh .
```

_You should see the size drop from ~2GB down to roughly 10-50MB._

---

### 4. Optional: Create a Compressed Archive

If you want to keep this backup truly "frozen" and out of the way, you can compress it into a single file:

Bash

```
cd ..
tar -czvf jules_v3_frozen.tar.gz current_V3_Frozen_Backup_20260120/
# You can now delete the uncompressed backup folder if you wish
# rm -rf current_V3_Frozen_Backup_20260120/
```

---

### 📝 Final Checklist for the "New Stage"

Now that your backup is safe, you are ready to start the next stage in your `current/` directory. Before you write the first line of code, remember:

1. **Clear the Laptop State:** Run `rm -rf frontend/.next` and `cargo clean` in the backend of your active `current/` folder to ensure no old build logic interferes with new code.
    
2. **Verify Branch:** Ensure you are on a fresh branch for this new stage (e.g., `git checkout -b feature/stage-4-architecture`).
    

# Demo Admin superuser
Since we haven't built a "Super Admin Dashboard" UI yet, and the database trigger is currently locking out everyone (it's set to the `0000...` UUID), you have to perform a "Coronation" manually in the database.

### First get into SQL; 
#### Option 1: The "Hacker" Way (Command Line)

If you have PostgreSQL installed on your machine (which you likely do if the app is running locally), you have a tool called `psql`.

1. **Find your Connection URL:** Open your `backend/.env` file and copy the `DATABASE_URL` (e.g., `postgres://postgres:password@localhost:5432/my_db`).
    
2. **Run the command:** Paste this into your terminal:
    
    Bash
    
    ```
    psql "postgres://postgres:password@localhost:5432/my_db"
    ```
    
    _(Replace the URL string with the one from your `.env` file)_
    
3. **Run your SQL:** Once you see the `postgres=#` prompt, you can paste your queries:
    
    SQL
    
    ```
    SELECT username, tenant_id FROM users;
    ```
    
    (Type `\q` to exit).
    

---


#### Option 2: The "Docker" Way (If using Containers)

If your database is running inside a Docker container (common in dev setups), you can jump directly inside it without installing anything on your laptop.

1. **Find the Container ID:**
    
    Bash
    
    ```
    docker ps
    ```
    
2. **Open the SQL Shell:**
    
    Bash
    
    ```
    docker exec -it <CONTAINER_ID_OR_NAME> psql -U postgres -d <YOUR_DB_NAME>
    ```
Localhost:  `docker exec -it 5466f9dd5bae psql -U postgres -d finance_db_local`
Server: `docker exec -it app-db-1 psql -U postgres -d finance_db`

### 1. Identify the Correct Database

Inside your `psql` shell, run the following command to see all available databases:

SQL

```
\l
```

Look for a database name like **`evolutesix`**, **`jules_bp`**, or **`current`**.

### 2. Connect to the Right Database

Once you see the correct name in that list, you can switch to it without leaving the shell:

SQL

```
\c your_database_name_here
```

LocalHost:  \c finance_db_local
Server:  `\c finance_db`

### 3. Verify the Tables

To make 100% sure you are in the right place, list the tables:

SQL

```
\dt
```

You should see `users`, `events`, `funds`, and others. If you see them, your original query will now work:

SQL

```
SELECT email, username, tenant_id FROM users;
```
Here is the 3-step sequence to promote yourself to **Demo Admin** and publish your first template.

### Step 1: Find your Tenant ID

You need to know who you are in the database. Run this in your SQL tool or terminal:

SQL

```
-- Find your tenant_id
SELECT username, tenant_id FROM users; 
-- Copy the UUID for your user (e.g., 'a1b2c3d4-...')
```
Server:  `SELECT 'Demo_Admin', 'bc64bdc1-f29b-489a-986f-0c94ea687632' FROM users;`

### Step 2: "Coronate" Yourself (Update the Guard)

The trigger is currently rejecting everyone. You need to update the function to recognize **your** UUID as the authorized publisher.

Run this SQL (replace the `0000...` with your actual UUID from Step 1):

SQL

```
CREATE OR REPLACE FUNCTION guard_public_templates()
RETURNS TRIGGER AS $$
BEGIN
    -- REPLACE WITH YOUR REAL TENANT ID BELOW:
    IF NEW.is_public_template = TRUE AND NEW.tenant_id != 'YOUR-ACTUAL-TENANT-UUID-HERE'::uuid THEN
        RAISE EXCEPTION 'Security Violation: Only the designated Demo Admin can publish templates.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```
Enter these lines line by line. The first CREATE opens a new level of shell, which ends with the last `$$`

### Step 3: Publish the Template

Now that the guard recognizes you, simply pick the Fund you want to be the template and flip the switch using SQL:

SQL

```
-- 1. Find the Fund ID (list all funds)
SELECT id, fund_name FROM funds WHERE tenant_id = 'YOUR-ACTUAL-TENANT-UUID-HERE';

-- 2. Publish it
UPDATE funds 
SET is_public_template = true 
WHERE id = 'THE-FUND-UUID-HERE';

-- OR
UPDATE funds SET is_public_template = true WHERE id IN ( 'FIRST-UUID-HERE', 'SECOND-UUID-HERE' );
```
Enter 2. lines line by line. 


**Result:**

- Because your `tenant_id` matches the Function, the trigger allows the update.
    
- If anyone else (or you, if you sign up as a different user) tries to do this, the DB will reject it.
    
- This fund will now appear in the results of `GET /api/lifecycle/templates`.


# Fix a password in the Scaleway database
### Method 1: The "Clone a Hash" Trick (Fastest)

If you have a test account (or your own admin account) where you **know** the password, you can just copy the hash from your account and paste it into theirs. This temporarily sets their password to be the exact same as yours.

**1. Find the column name:** Run this in `psql` to see the structure of your users table (look for `password_hash` or something similar):

SQL

```
\d users
```

**2. Copy a known hash:** Let's say your email is `graham@example.com` and you know your password is "Temp123!". Get your hash:

SQL

```
SELECT email, password_hash FROM users WHERE email = 'graham@example.com';
```

**3. Paste it to the locked user:** Take that long, gibberish string (the hash) and update the locked user's row:

SQL

```
UPDATE users 
SET password_hash = 'PASTE_YOUR_HASH_HERE' 
WHERE email = 'lockeduser@example.com';
```

_Now, the user can log in with "Temp123!" and change it th_


## CAT all of the files into one, with names, for a single upload.

`find . -type f -name "*.sql" -not -path "./.sqlx/*" -exec sh -c 'echo "<file $1>"; cat "$1"; echo "</file>"' _ {} \; > all_schema.txt`




# Installing PYTHON in a new directory

Bash

```
# 1. Create the virtual environment folder (.venv)
python3 -m venv .venv

# 2. Activate it (just to install the library)
source .venv/bin/activate

# 3. Install the AI library
pip install google-genai

# 4. Deactivate (The script handles activation itself usually, but we are done)
deactivate
```


### The Fix if Python has been updated by Linux: Nuke and Rebuild

Because your `do_task.sh` script already has the intelligence to build a virtual environment if one doesn't exist, the easiest solution is to just throw the broken one in the trash.

**1. Delete the broken environment:**

Bash

```
rm -rf .venv
```

# Docker CLI for Wordpress
**The Easiest Fix for Ubuntu:** Run this command to download the `wp-cli` binary directly into your running container so your scripts work immediately:

Bash

```
docker exec -it --user root evolutesix-wp sh -c "curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && chmod +x wp-cli.phar && mv wp-cli.phar /usr/local/bin/wp"
```


# Wordpress deployment

Build tailwind for deployment. 
`npx tailwindcss -i ./global.css -o ./theme/assets/css/style.css --minify`

then wire it up with:
`./scripts/do_task.sh "CONTEXT: Bridging compiled Tailwind CSS into the WordPress theme architecture. ACTION: Ensure theme/style.css contains a standard WordPress Theme header block (Theme Name: Evolutesix 2026, Author: Web_Creator_E6). Then, update theme/functions.php to enqueue the compiled CSS from assets/css/style.css using wp_enqueue_style and get_template_directory_uri. CONSTRAINTS: The root theme/style.css must only contain the comment header. Do not use exclamation marks." theme/style.css theme/functions.php docs/ARCHITECTURAL_CONTEXT_CLI.md`

Then issue the whole git sequence.
### **The Recommended Namecheap Workflow: Softaculous Staging**

Namecheap cPanel includes a brilliant tool called **Softaculous Apps Installer**. It has a built-in "Staging" and "Push to Live" feature that handles all the complex database URL rewriting for you automatically.

Here is the exact strategy I recommend we use:

#### **Phase 1: The Staging Setup (Today)**

1. **Create a Subdomain:** In cPanel, go to **Subdomains** and create `2026.evolutesix.com`. This will automatically create a document root folder at `/home/grahxapf/2026.evolutesix.com/`.
    
2. **Install WordPress:** Use Softaculous in cPanel to install a fresh copy of WordPress onto `2026.evolutesix.com`.
    
3. **Deploy the Theme:** We will point our `.cpanel.yml` Git deployment directly to this staging folder.
    
4. **Build & Test:** You and the team can review the fully functioning site at `http://2026.evolutesix.com` while the public placeholder remains untouched.
    

#### **Phase 2: Going Live (Future)**

1. When you are 100% happy with the staging site, you will go back into Softaculous in cPanel.
    
2. Click the **"Push to Live"** button next to your staging installation.
    
3. Softaculous will seamlessly clone the files and database into your empty `/home/grahxapf/evolutesix.com/` folder and mathematically rewrite all the URLs in the database to the production domain.
    
4. You then update your DNS to point `evolutesix.com` to Namecheap, and the site is live!

 npm run build
  git add .
  git commit -m "Finalize image assets, WordPress functions, and compiled Tailwind CSS"
  #2. Merge into local main
  git checkout main
 git merge @{-1}
 #3. Push main to GitHub (Your backup and source of truth)
 git push origin main
 #4. Move the code to production and deploy
 git checkout production
 git merge main -m --no-ff
 git push origin production
 #5. Safely return to main for future development
 git checkout main



# Automated Debugging and Validation
This is an incredibly clear diagnostic map. Knowing that your biggest threat isn't syntax errors, but **silent, logical drifts in complex financial math** (like Monte Carlo simulations and non-ergodicity profit pooling), completely shifts our strategy.

In financial engineering, these are known as "invisible bugs"—the code compiles perfectly, the loops run flawlessly, but the mathematical logic is quietly bleeding or distorting data.

Because you currently have zero automated tests but you have access to both **Jules (Google's asynchronous cloud coding agent)** and your local **Gemini CLI**, you can build a defensive validation shield without having to manually write thousands of lines of boilerplate testing code.

## 🛠️ The 3-Tier Validation Blueprint

### Phase 1: Deploy the Static Defense (Stop the Tech Debt)

Before trying to prove the mathematics are correct, we must ensure the code isn't hiding bugs in unhandled variables or sloppy types.

Run these two commands manually in your terminal today:

1. **In the Backend:** Run `cargo clippy &> clippy_output.txt`. Clippy is Rust’s native code-smell detector. It will deeply scan your Monte Carlo code for unoptimized logic, memory overhead, and hidden anti-patterns.
    
2. **In the Frontend:** Run `npx tsc --noEmit`. This forces TypeScript to check every single file for type safety. It guarantees that a frontend component isn’t passing a string where your simulation expects a floating-point number. If there is no output, all is fine.
    

### Phase 2: Task Jules with "Statistical Invariant" Testing

Because Jules clones your repository into an isolated cloud virtual machine, builds your project, and can run code execution loops autonomously, it is the **perfect vehicle** to build your missing safety net.

Standard unit tests ("does this function return an array?") won't catch a broken profit-pooling algorithm. You need **Invariant Property Testing**—testing that a statistical truth holds true no matter how many times the Monte Carlo simulation runs.

#### How to prompt Jules:

Go to Jules (or use its issue tracking pipeline) and give it an explicit, highly targeted task:

> **Prompt for Jules:** "I need a comprehensive statistical integration test for the Monte Carlo simulation engine and the profit pooling logic located in `backend/src/...`.
> 
> Currently, there is no automated testing suite. Please bootstrap a standard Rust integration test file (`tests/monte_carlo_tests.rs`).
> 
> **The Core Invariant to Test:** Profit pooling is mathematically designed to minimize the degree of non-ergodicity. Therefore, across 10,000 simulated paths, a pooled multi-tenant cohort _must_ display a lower final variance and a higher median wealth trajectory than an unpooled cohort over time.
> 
> Write a test that runs both scenarios with mock financial parameters, calculates the variance of the outputs, and asserts that the pooled variance is strictly less than the unpooled variance within a 95% confidence interval. Let the test suite run, verify execution in your VM, and generate a PR."

Jules will write the test, attempt to compile and run it via `cargo test`, see if it fails, adjust the code or the test parameters autonomously, and hand you a clean Pull Request.

### Phase 3: The Local Gemini CLI "Differential Audit"

While Jules is cooking your automated test suite in the cloud, you can use your newly upgraded local `do_task.sh` with the heavy-duty model and the thinking engine to perform a deep logical sanity check on specific mathematical formulas.

You can target your simulation file directly using the thinking engine:

Bash

```
./scripts/do_task.sh -m gemini-3.1-pro-preview --think "CRITICAL AUDIT: Look closely at how profit pooling is calculated in this file. Step-by-step, trace the wealth allocation across multiple iterations. Is there any logical leak where non-ergodicity is preserved rather than minimized? Explain your mathematical reasoning before suggesting modifications." backend/src/simulation/mod.rs
```

Because you turned on the `--think` switch, the model will run a highly disciplined mental simulation of your code’s execution path before it outputs a single line, helping you catch structural flaws _before_ they manifest in production.

### 🧠 The Reality: Thinking is _Always On_ for Gemini 3 / 3.1 Pro

For the Gemini 3 and 3.1 Pro series, **the internal reasoning engine cannot be turned off**. It is baked directly into the model's core architecture.

The model _always_ pauses, maps out the math, and plans its strategy internally before it generates a single line of code. By default, 3.1 Pro automatically runs at the highest possible thinking level (`HIGH`). Gemini 3.5 Flash defaults to a lower reasoning level (`MEDIUM`) to keep things fast.

### ⚙️ What our `--think` Flag Actually Toggles

Because the AI is _always_ thinking under the hood anyway, our `--think` flag doesn't turn the brain on; **it opens the curtain so you can see it work**.

In our `builder.py` script, the `--think` flag injects this specific setting:

Python

```
thinking_config=types.ThinkingConfig(include_thoughts=True)
```

This instructs the API to stream the AI's raw, internal "scratchpad" thoughts right into your terminal and your `ai_solution.md` file alongside the final answer.

### 📊 Flash vs. Pro Matrix

Here is exactly what happens behind the scenes depending on how you fire the command:

| **Command**                                | **Model Used** | **Reasoning Depth**                                 | **What gets saved to ai_solution.md**             |
| ------------------------------------------ | -------------- | --------------------------------------------------- | ------------------------------------------------- |
| `./do_task.sh -m gemini-3.5-flash`         | 3.5 Flash      | **Moderate** (`MEDIUM` level) *GB-Suspect not true* | Just the final code adjustments.                  |
| `./do_task.sh -m gemini-3.5-flash --think` | 3.5 Flash      | **Moderate** (`MEDIUM` level)                       | The step-by-step logic text **AND** the code.     |
| `./do_task.sh` _(Defaults to Pro)_         | 3.1 Pro        | **Maximum** (`HIGH` level)                          | Just the final, architected code files.           |
| `./do_task.sh --think` _(Defaults to Pro)_ | 3.1 Pro        | **Maximum** (`HIGH` level)                          | The raw mathematical scratchpad **AND** the code. |

### 🎯 How to leverage this for your Monte Carlo Auditing

Your conclusion that the flag is "irrelevant" for Pro is true if you _only care about the final code output_. The Pro model will give you the same high-tier architectural results whether you pass the flag or not.

**However, the `--think` flag becomes highly relevant when debugging complex math like ergodicity and profit pooling.** If you run the Pro model _with_ `--think` on your simulation files, you get to read the AI's full, unedited internal mathematical proof. You will see it literally write out things like:

> _"If I pool the profit using a standard arithmetic mean, I am preserving an ensemble average which fails to address time-average non-ergodicity. Therefore, I must evaluate the geometric variance across paths..."_

It essentially acts as a free, highly detailed **Code Audit Report** printed right at the top of your markdown file.


### Your Final Optimization Blueprint

| **Environment**    | **Agent Role**      | **Chosen Model**        | **Why This Model?**                                               |
| ------------------ | ------------------- | ----------------------- | ----------------------------------------------------------------- |
| **Browser (Web)**  | Frontend Management | **Gemini 3.5 Thinking** | Fast component planning, zero browser lag.                        |
| **Browser (Web)**  | Backend Management  | **Gemini 3.5 Thinking** | High-level orchestration, **bypasses the timeout glitch.**        |
| **Terminal (CLI)** | Frontend Executor   | **Gemini 3.5 Flash**    | Blazing fast TypeScript generation, lowest API costs.             |
| **Terminal (CLI)** | Backend Executor    | **Gemini 3.1 Pro**      | Absolute maximum reasoning for Rust lifetimes & Monte Carlo math. |



