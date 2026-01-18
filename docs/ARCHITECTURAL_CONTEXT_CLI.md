

# Status: UNIVERSAL CONSTITUTION (Read by every agent)
# Role: Immutable Constraints & Patterns

## 1. PROJECT GOAL
**Objective:** Build an enterprise-grade financial simulation engine (Monte Carlo) for startups and investors.
**Core Philosophy:** "Correctness over Convenience." We model non-ergodic path dependence. Simulate path-dependent volatility using specific distributions (Normal, Student's T, NRIG).
**Identity:** Username-based.


# 2. IMMUTABLE
## 2.1. TECHNOLOGY STACK (Immutable)
* **Backend:**
    * **Language:** Rust (Edition 2021).
    * **Web Framework:** `axum` (with `tokio`).
    * **Database:** PostgreSQL via `sqlx` (Compile-time checked queries).
    * **Math:**  **Hybrid Architecture**: **Storage & API:** Strict `rust_decimal` (The Fortress Standard) ; **Simulation Engine:** `f64` (The Performance Standard).
    * **Serialization:** `serde` / `serde_json`.
* **Frontend:**
    * **Framework:** Next.js 14+ (App Router).
    * **Language:** TypeScript.
    * **Styling:** Tailwind CSS (Utility classes).
    * **HTTP Client:** Axios (via `lib/api.ts`).
    * **Visualization:** Chart.js (`react-chartjs-2`).


## 2.2. The Immutable Data Contract

These rules govern the communication between the Frontend and Backend.

- **The String-Decimal Standard**: All Currency, Decimals, and Percentages MUST be transmitted as **Strings** (e.g., `"1250.50"`, `"3.0"`).
    
- **The Percent Standard**: Rates must be sent as **whole-number strings** (e.g., `"3.0"` for 3%) and include the **`_percent` suffix** in the key (e.g., `growth_rate_percent`).
    
- **Scoped Naming**: Fields must be scoped to their entity (e.g., `role_name`, `expense_name`) and never named simply `name`.
    
- **Lowercase Normalization**: All category, frequency, and type indicators (e.g., `fixed_count`, `student_t`) must be transmitted in **lowercase**.
    
- **Identifiers**: All resource IDs must be valid **UUID v4**. 

- **Audit Metadata**: Every core financial table must include a non-nullable `created_at: DateTime<Utc>` field.
    
- **Explicit SQL**: The use of `SELECT *` is strictly forbidden.
    
- **Query Safety**: Every query must explicitly list columns and utilize the SQLx "Force Non-Null" `!` syntax (e.g., `column as "column!"`) where necessary.
    

### 🏁 Unified Identity Contract for the Frontend Architect

| **Entity**   | **Field**   | **Source of Truth**                                    |
| ------------ | ----------- | ------------------------------------------------------ |
| **Identity** | `user_id`   | **UUID** (Stored in JWT and returned in AuthResponse)  |
| **Auth**     | `sub`       | **Username** (String, used only for display)           |
| **Security** | `tenant_id` | **UUID** (The primary filter for ALL database queries) |
### 🏁 Standardized `AuthResponse` Contract

To stop the loop, the Backend and Frontend must agree on this exact JSON structure for the login and registration responses:

| **Field**       | **Type** | **Description**                                                      |
| --------------- | -------- | -------------------------------------------------------------------- |
| **`token`**     | `String` | The JWT used for all subsequent "Protected Routes".                  |
| **`user_id`**   | `Uuid`   | The database primary key of the user (Mandatory for Frontend state). |
| **`username`**  | `String` | The human-readable name for UI display (e.g., "GB3").                |
| **`tenant_id`** | `Uuid`   | The organization ID required for data isolation.                     |
final "Source of Truth" points to your Frontend Architect:
        
- **Identity Mapping**: The `user_id` is the database primary key; the `username` is for display.
    
- **JWT Claims**: The token contains `sub` (the username) and `tenant_id`.
    
- **Debugging Status**: The backend will continue to return a `401` on auth failure. The frontend must be the one to disable the automatic redirect for inspection.

# 3. CORE
## 3.1. CORE ENGINE LOGIC (`backend/src/projection.rs`)
* **Mechanism:** Breadth-First Traversal (Time-step based).
* **Scope:** Handles Revenue, COGS, OpEx, Capital Injections, Dividends, Credit Facilities.
* **Monte Carlo:** Runs 1000+ iterations (if enabled). Calculates percentiles (P5, P50, P95).
* **Insolvency:** Logic stops simulation trajectory if `cash < -credit_limit`.

## 3.2. CORE PATTERNS (The "Local Customs")
* **Backend API:**
    * **Injection:** Always inject DB pool via `State(pool): State<Pool<Postgres>>`.
    * **Errors:** Handlers return `Result<Json<T>, AppError>`. Never return raw Results.
    * **Structure:** No generic "Envelope" wrapper. Return the struct/vector directly.
* **Frontend Data:**
    * **Fetching:** Use `useEffect` + `api.ts` (Axios wrapper).
    * **State:** Local State preferred. No Redux/Zustand unless specified.
    * **Ids:** Treat all IDs as strings on the Frontend; `Uuid` on the Backend.

## 4. DIRECTORY MAP & TOOLING
* **Backend Structure:**
    * `backend/src/handlers/` -> All API route logic (grouped by resource).
    * `backend/src/models.rs` -> shared Structs and DB schemas.
    * `backend/migrations/` -> SQLx migration files (SQL).
* **Frontend Structure:**
    * `frontend/app/` -> Next.js Pages and Layouts.
    * `frontend/lib/api.ts` -> Central Axios client.
    * `frontend/components/` -> UI elements (Tailwind).
* **Migration Command:**
    * Use `sqlx migrate add <name>` to create.
    * Use `sqlx migrate run` to apply (automated in `main.rs`, but good to know).

## 5. THE "IRON LAWS" (Stage 3 Strictness)
* **Tenant Isolation:**
    * **Strict Rule:** Every business entity (Fund, Company) MUST belong to a `tenant_id`.
    * **Query Rule:** Every SQL `SELECT`, `UPDATE`, or `DELETE` must explicitly filter `WHERE tenant_id = $1`.
    * **Injection:** `tenant_id` comes from the JWT Claims (Extension), NEVER from the user request body.
* **Code Style:**
    * **Database/API:** `snake_case` (e.g., `growth_rate`, `tenant_id`).
    * **Rust Structs:** `PascalCase` (Internal Type Names).
    * **TS Interfaces:** Match the API (`snake_case`). Do not map to camelCase.

## 6. UNIVERSAL BUILDER PROTOCOL
* **File Operations:**
    * You are a CLI tool. When asked to edit a file, output the **FULL FILE** content inside XML tags `<file path="...">...</file>`.
    * Do not use placeholders like `// ... existing code ...`.
* **Testing:**
    * If `last_error.log` is provided, priority #1 is fixing that error.
* **Dependencies:**
    * Do not add new crates/packages unless explicitly instructed by the Architect prompt.