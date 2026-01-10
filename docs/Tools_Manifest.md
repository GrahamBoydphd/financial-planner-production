
### 🛠️ The Executive Toolbelt (For Your Eyes Only)

| **Command**                      | **Status**       | **When to use it**                                                                                             |
| -------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| **`./scripts/do_task.sh "..."`** | **Daily Driver** | The only tool the Agents know. Use this to build/edit code.                                                    |
| **`./scripts/try_build.sh`**     | **Debugger**     | It generates `last_error.log`. **Crucial:** If you get an error, run this, _then_ ask the Architect to fix it. |
| **`./scripts/clean-slate.sh`**   | **Nuclear**      | Wipes the database completely. Use this if your migrations get hopelessly tangled and you want to start fresh. |
| **`./scripts/transplant.sh`**    | **Reset**        | Nuke & Pave the Frontend. Use only if the Next.js setup is fundamentally broken.                               |
| **`./scripts/update_docs.sh`**   | **⚠️ DANGER**    | **Avoid.** As you noted, this overwrites learnings. Rely on our new `ARCHITECTURAL_CONTEXT_CLI.md` instead.    |

🤖 Connecting to gemini-3-pro-preview (Paid Tier)...
<file path='scripts/ARCHITECTURAL_CONTEXT.md'>
# ARCHITECTURAL_CONTEXT.md
# Current Status: BUILD PHASE - FRONTEND AUTHENTICATION
# Last Updated: January 7, 2026

## 1. PROJECT GOAL
**Objective:** Build a financial simulation engine capable of non-ergodic (Monte Carlo) analysis for startups.
**Core Philosophy:** Avoid "average of averages." Simulate path-dependent volatility.

## 2. ESTABLISHED CONSTRAINTS & PATTERNS
* **Tech Stack:** Rust (Axum/SQLx), Next.js, PostgreSQL.
* **Math:** `rust_decimal` for all currency.
* **Multi-Tenancy & Security:** JWT (Argon2), Tenant Isolation via Middleware.
    1. **Strict Isolation:** All database queries for business entities MUST filter by 'tenant_id'.
    2. **Auth Token Source:** 'tenant_id' must be extracted from 'Extension<Claims>'.
    3. **Write Operations:** INSERTs must populate 'tenant_id' from claims.
    4. **Read Operations:** SELECTs must include 'WHERE tenant_id = '.

## 3. TOOLS MANIFEST & AUTOMATION WORKFLOW
**Overview:** This project uses a custom shell/Python toolchain to automate AI coding tasks, deployment, and environment resets.

### A. AI-Assisted Development (The "Do Task" Loop)

#### 1. `scripts/do_task.sh`
* **Purpose:** The primary entry point for AI coding tasks; orchestrates context packing, AI generation, and code application.
* **Usage Syntax:** `./scripts/do_task.sh "Task Description" [file_paths...]`
* **Key Behaviors:**
    *   Auto-manages a Python virtual environment (`.venv`) and installs `google-genai`.
    *   Creates a unique git branch (`ai-fix-TIMESTAMP`).
    *   Calls `pack_context.sh` to bundle the prompt.
    *   Calls `builder.py` to generate the solution.
    *   Prompts the user interactively to apply changes via `apply.py`.
* **Safety Mechanisms:**
    *   **Branch Isolation:** Always works on a new branch; never commits directly to main.
    *   **Interactive Gate:** Requires user confirmation ("y") before modifying files.
    *   **Env Check:** Warns if `.env` is missing.

#### 2. `scripts/pack_context.sh`
* **Purpose:** Aggregates architectural context, error logs, and specific source files into a single prompt packet.
* **Usage Syntax:** `./scripts/pack_context.sh "Prompt Message" [file_paths...]`
* **Key Behaviors:**
    *   Reads `ARCHITECTURAL_CONTEXT.md` to enforce guidelines.
    *   Includes `last_error.log` automatically if it exists (contextual debugging).
    *   Wraps all content in XML tags (`<system_context>`, `<source_code>`) for the AI.
* **Safety Mechanisms:**
    *   Validates file existence before reading to avoid empty context blocks.

#### 3. `scripts/builder.py`
* **Purpose:** Transmits the prompt packet to Google's Gemini API and streams the generated code.
* **Usage Syntax:** `python3 ./scripts/builder.py <packet_file>`
* **Key Behaviors:**
    *   Connects to Gemini Pro (e.g., `gemini-3-pro-preview`) using `GOOGLE_API_KEY`.
    *   Streams output to stdout to provide immediate feedback.
    *   Configured with low temperature (0.1) for deterministic code generation.
* **Safety Mechanisms:**
    *   Validates API key presence.
    *   Handles API errors (429/403) with helpful debugging messages.

#### 4. `scripts/apply.py`
* **Purpose:** Parses the AI's XML response and writes the code to the actual file system.
* **Usage Syntax:** `python3 ./scripts/apply.py <response_file>`
* **Key Behaviors:**
    *   Uses Regex to extract content between `<file path="...">...</file>` tags.
    *   Automatically creates parent directories if they don't exist.
    *   Overwrites existing files with the new content.
* **Safety Mechanisms:**
    *   **Path Traversal Protection:** Rejects paths containing `..` or starting with `/` to prevent writing outside the repo.
    *   **Format Validation:** Exits gracefully if no valid XML tags are found.

### B. Deployment & CI/CD

#### 5. `scripts/deploy.sh`
* **Purpose:** Builds the Docker image and pushes it to the Scaleway Container Registry.
* **Usage Syntax:** `./scripts/deploy.sh [TAG]` (default: `latest`)
* **Key Behaviors:**
    *   Loads secrets from `.env`.
    *   Auto-authenticates with Docker registry using `SCW_SECRET_KEY`.
    *   Builds for `linux/amd64` architecture (production standard).
    *   Pushes the image to `rg.nl-ams.scw.cloud`.
* **Safety Mechanisms:**
    *   `set -e`: Aborts immediately if any step (login, build, push) fails.
    *   Checks if Docker daemon is running before starting.

#### 6. `scripts/trigger-update.sh`
* **Purpose:** Triggers the production server to pull the latest code and restart containers.
* **Usage Syntax:** `./scripts/trigger-update.sh`
* **Key Behaviors:**
    *   Connects via SSH using a specific key (`id_ed25519_Scaleway...`).
    *   Forces a `git reset --hard` to match the remote branch (discards server drift).
    *   Runs `docker compose build --no-cache` to ensure fresh binaries.
    *   Restarts containers with `--remove-orphans`.
* **Safety Mechanisms:**
    *   `set -e` on the remote server ensures the script stops if git or docker fails.

### C. Maintenance & Environment Utilities

#### 7. `scripts/clean-slate.sh`
* **Purpose:** Resets the Frontend dynamic routes to a pristine, minimal state to fix "ghost file" issues.
* **Usage Syntax:** `./scripts/clean-slate.sh`
* **Key Behaviors:**
    *   **Destructive:** Deletes `frontend/app/company`, `fund`, and `plan` folders.
    *   Recreates directory structure and writes minimal `ClientPage.tsx` and `page.tsx` wrappers.
    *   Generates a strict `.dockerignore` to prevent context pollution.
* **Safety Mechanisms:**
    *   Targeted deletion (only removes specific subfolders, not the whole app).

#### 8. `scripts/transplant.sh`
* **Purpose:** Replaces the *entire* frontend directory with a fresh Next.js installation structure.
* **Usage Syntax:** `./scripts/transplant.sh`
* **Key Behaviors:**
    *   Moves existing `frontend` to `frontend_backup`.
    *   Generates fresh `package.json`, `tsconfig.json`, and `next.config.js` (configured for static export).
    *   Creates a minimal "System Status" landing page.
* **Safety Mechanisms:**
    *   **Backup:** Preserves the old frontend in `frontend_backup` before creating the new one.

#### 9. `scripts/try_build.sh`
* **Purpose:** Validates that the Rust backend compiles without errors.
* **Usage Syntax:** `./scripts/try_build.sh`
* **Key Behaviors:**
    *   Runs `cargo build` in the backend directory.
    *   Captures compilation errors to `last_error.log` for AI analysis.
* **Safety Mechanisms:**
    *   Non-destructive (read-only build).
    *   Cleans up the log file if the build succeeds.

#### 10. `scripts/update_docs.sh`
* **Purpose:** Resets documentation files to a standardized state.
* **Usage Syntax:** `./scripts/update_docs.sh`
* **Key Behaviors:**
    *   Overwrites `ARCHITECTURAL_CONTEXT.md`, `PRODUCTION_LEARNINGS_V1.md`, and `COMMAND_LOG.md` with hardcoded content. 
    *   (User input: this is poor behaviour because we lose previous learnings. The new workflow must merge what is still relevant from old learnings with the new learnings.)
* **Safety Mechanisms:**
    *   None (Overwrites files directly). *Note: Used to enforce documentation standards.*
</file>

