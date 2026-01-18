
# 💎 Master Architectural Reference: The Fortress Standard (V3)

**Status**: Hardened | **Date**: 2026-01-16 | **Target**: Frontend & Backend Architects
**Core Mission**: To maintain 100% mathematical integrity and structural consistency across the Evolutesix Financial Engine.

## 1. TECHNOLOGY STACK (Immutable)

The stack is selected for institutional-grade precision, type safety, and high-performance simulation execution.

* **Backend:**
    * **Language:** Rust (Edition 2021).
    * **Web Framework:** `axum` (with `tokio`).
    * **Database:** PostgreSQL via `sqlx` (Compile-time checked queries).
    * **Math:** `rust_decimal` for ALL currency/rates. `f64` is **BANNED** for money.
    * **Serialization:** `serde` / `serde_json`.


* **Frontend:**
    * **Framework:** Next.js 14+ (App Router).
    * **Language:** TypeScript.
    * **Styling:** Tailwind CSS (Utility classes).
    * **HTTP Client:** Axios (via `lib/api.ts`).
    * **Visualization:** Chart.js (`react-chartjs-2`).


### **Database & Infrastructure**

- **Database**: **PostgreSQL**.
    
- **Infrastructure**: **Docker** and **Docker-Compose** for environment parity.
    
- **Migrations**: Managed via `sqlx` to ensure schema integrity.
    

---

## 2. The Immutable Data Contract

These rules govern the communication between the Frontend and Backend.

| **Layer**         | **Type**                     | **Responsibility**                            |
| ----------------- | ---------------------------- | --------------------------------------------- |
| **Storage / API** | `rust_decimal::Decimal`      | Exactness, no rounding errors in DB.          |
| **Boundary**      | `ToPrimitive::to_f64()`      | One-time conversion with overflow safety.     |
| **The Hot Path**  | `f64`                        | Hardware-level speed for 1,000+ trajectories. |
| **Aggregator**    | `Decimal::from_f64_retain()` | Convert results back for the API response.    |
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

### 2. For the _NEW_ Frontend Architect (The Reboot)

**ACT AS:** Frontend Architect (Strict View Layer Focus). **CONTEXT:** You are taking over a project with a strict "Fortress Standard" architecture. Your predecessor was removed for confusing business logic with view logic. **The Golden Rule:** You do not define the schema. You do not do math. You render what the Backend sends.

**YOUR BIBLE (FRONTEND_ANCHOR.md):** [Paste the content of the Version 3.1 Anchor Document I generated above here]

**IMMEDIATE MISSION:**

1. **Audit:** Scan the current `frontend/` directory.
    
2. **Purge:** Identify any client-side calculations (e.g., projecting future months locally). Mark them for removal.
    
3. **Align:** Ensure all Input Forms in `components/forms/` are strictly using the **String/Percentage** contract (e.g., `growth_rate_percent` as "3.0", not 0.03).
    
4. **Report:** Confirm you have ingested the Anchor and are ready to build the **Fund Dashboard**.

---

## 3. CORE
## 3.1. CORE ENGINE LOGIC (`backend/src/projection.rs`)
* **Mechanism:** Breadth-First Traversal (Time-step based).
* **Scope:** Handles Revenue, COGS, OpEx, Capital Injections, Dividends, Credit Facilities.
* **Monte Carlo (Company):** Runs 1000+ iterations of a single company (if enabled). Calculates percentiles (P5, P50, P95).
* **Monte Carlo (Fund):** Runs 1000+ iterations of an entire fund of $n$ companies (if enabled). Calculates percentiles (P5, P50, P95).
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

---
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

---
## 5. THE "IRON LAWS" (Stage 3 Strictness)
* **Tenant Isolation:**
    * **Strict Rule:** Every business entity (Fund, Company) MUST belong to a `tenant_id`.
    * **Query Rule:** Every SQL `SELECT`, `UPDATE`, or `DELETE` must explicitly filter `WHERE tenant_id = $1`.
    * **Injection:** `tenant_id` comes from the JWT Claims (Extension), NEVER from the user request body.
* **Code Style:**
    * **Database/API:** `snake_case` (e.g., `growth_rate`, `tenant_id`).
    * **Rust Structs:** `PascalCase` (Internal Type Names).
    * **TS Interfaces:** Match the API (`snake_case`). Do not map to camelCase.

---
## 6. Statistical & Business Logic

- **P50 Trajectory**: The "Median" line represents the fictitious path connecting the **median value of each individual month** across 1,000 simulations.
    
- **Metric Alignment**: Runway, Valuation, and Net Value labels must be derived from the **P50 Cash Trajectory** path.
    
- **Anniversary Raises**: Salary inflation is applied on the role's **hire-month anniversary**, calculated as `(m - role.start_month) / 12`.
    
- **Relative Time**: All time markers must be **Integers** representing relative months (e.g., Month 1).


---
## 7. Simulation & Business Logic

The Frontend Architect must ensure the UI accurately reflects the Engine's stochastic capabilities:

- **P50 Trajectory (The Median) in any Monte Carlo simulation**: The "Median" line on charts is a fictitious path connecting the 500th value (of 1,000 simulations) for **each individual month**.
    
- **Visual Alignment**: UI labels for Runway and Valuation must be derived from this specific monthly median trajectory to ensure the data matches the line graph.
    
- **Relative Time**: The system uses **Integers** for months (e.g., Month 1, Month 12) rather than calendar dates.
    
- **Staffing Anniversaries**: Salary increases are applied on the role's hire-anniversary month, calculated as `(m - role.start_month) / 12`, not at the start of a calendar year.
    
- **Negative Volatility**: The UI must support and transmit negative bounds for volatility (e.g., `vol_min: "-30.0"`).
- 
---


## 8. Architectural Context: Monte Carlo Engine (V3)

### 1. Survival Logic & State Erasure

The engine now enforces a **"Hard-Stop Insolvency"** model to prevent "Zombie" companies from skewing portfolio valuations.

- **Trigger**: Insolvency is triggered at the end of any month $X$ if `cash_balance < 0`.
    
- **Phase Lag**: Month $X$ (the "Month of Death") records the actual financial transactions that caused the failure.
    
- **Total Erasure**: Starting in Month $X+1$, the simulation forces all financial flows (Revenue, OpEx, Gross Profit, etc.) and the `cash_balance` to exactly **0.00**.
    
- **Boolean State**: The engine uses a single boolean flag, `is_solvent`, as the source of truth for a trajectory's viability.
    

### 2. Statistical Integrity: The Anchored Median

To solve the "Frankenstein Data" issue—where a single row in the results table might mistakenly combine metrics from different simulation runs—the engine now uses **Anchored Trajectories**.

- **Primary Anchor**: For every month, the engine sorts all 1,000 runs strictly by their `cash_balance`.
    
- **Representative P50**: The P50 (median) row is no longer a collection of independent statistical medians. Instead, it is a **snapshot of the 500th run's entire state**.
    
- **Internal Consistency**: This ensures that if the median run is insolvent, the Revenue and Cash Balance for that month "snap" to zero simultaneously in the user's table.
    

### 3. Portfolio Mortality Metric

The engine now exposes the aggregate risk profile of the 1,000 runs through a temporal survival analysis.

- **Survival Rate**: A new metric, `survival_rate`, is calculated for every month in the simulation.
    
- **Formula**: $\text{Survival Rate}_m = \frac{\text{Count of Runs where } is\_solvent = true}{\text{Total Simulation Runs}}$.
    
- **Purpose**: This allows the UI to plot the "Cliff of Failure," showing exactly when a strategy's probability of survival begins to degrade.
    

### 4. Data Scoping & Identity

All financial and structural entities have been migrated to **Scoped Naming** to support the V3 Fund-Level views.

- Generic `name` fields are replaced by context-specific keys (e.g., `fund_name`, `company_name`, `revenue_name`) to prevent key collisions during multi-company aggregation.
    
- All queries enforce `tenant_id` isolation to ensure strict multi-tenancy security across the simulation engine.

---
## 9. Advanced Strategic Features (V3/V4)

The Frontend must support the following newly integrated stochastic models:

- **Distributions**: Support for `Normal`, `Student’s T`, and `NRIG` (Normal Reciprocal Inverse Gaussian) volatility models.
    
- **Cash Pooling**: Interface support for `pooling_fraction` parameters, allowing net gains to be harvested and redistributed across a portfolio of entities.
    
- **Hiring Ramps**: Support for sophisticated staffing plans including `fixed_count` and `monthly_rate` (e.g., adding 1 employee every 3 months).
    




