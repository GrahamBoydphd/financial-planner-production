# Backend Architectural Anchor

This document was produced by Jules, auditing the V1.0 code running on the server, and serves as the "Anchor Document" for the backend architecture. It describes the current reality of the codebase, naming conventions, API patterns, simulation logic, and database strategy.

## 1. Code Conventions

### Naming
- **Structs:** `PascalCase` (e.g., `FinancialPlan`, `RevenueItem`).
- **Database Columns:** `snake_case` (e.g., `plan_id`, `start_month`, `growth_rate_percent`).
- **Variables:** `snake_case` (standard Rust conventions).
- **JSON Serialization:** `snake_case` (default `serde` derivation).

### Types & Data Structures
- **IDs:** `Uuid` (crate: `uuid`) is used for all primary and foreign keys.
- **Financials:** `Decimal` (crate: `rust_decimal`) is strictly used for all monetary values, percentages, and growth rates to ensure precision.
- **Time:**
  - `NaiveDate` (crate: `chrono`) for specific dates (e.g., `start_month`).
  - `DateTime<Utc>` for audit timestamps (`created_at`).
  - `i32` for relative month indices (e.g., `shock_month`, `start_month` in items).
- **Nullability:** `Option<T>` is used for nullable database fields (e.g., `end_month`, `volatility_type`).
- **Enums:** Stored as `TEXT` in the database and mapped to strings or logic in Rust (e.g., `volatility_type` values like 'flat', 'student_t').

## 2. API Patterns

### Handlers
- Located in `backend/src/handlers/`.
- **Dependency Injection:** Database pool is injected via `axum::extract::State`.
  ```rust
  pub async fn handler(State(pool): State<Pool<Postgres>>, ...)
  ```

### Request/Response
- **Inputs:** dedicated Request structs (e.g., `CreatePlanRequest`) are defined for incoming JSON bodies.
- **Outputs:** Handlers return `Result<Json<T>, AppError>`.
- **Wrapping:** There is no generic "Envelope" or wrapper object. Responses are direct JSON serializations of the model or vector of models.

### Error Handling
- **Type:** `AppError` enum (defined in `backend/src/errors.rs`).
- **Variants:**
  - `InternalServerError`: Maps to HTTP 500.
  - `NotFound(String)`: Maps to HTTP 404 with a specific message.
  - `BadRequest(String)`: Maps to HTTP 400 with a specific message.
- **Behavior:** `IntoResponse` is implemented for `AppError` to return a JSON object `{ "error": "message" }`.
- **Database Errors:** `sqlx::Error` is automatically converted to `AppError::InternalServerError` (logging the detailed error to stderr).

## 3. Simulation Logic

### Location
- **Core Logic:** `backend/src/projection.rs`.
- **Entry Point:** `generate_simulation` function.

### Input Parsing
- **Aggregation:** Inputs are fetched from the database as raw models (`RevenueItem`, `ExpenseItem`, etc.) in `handlers/plans.rs` and passed to `generate_simulation`.
- **Internal State:** Inside the simulation, these models are converted into `ItemState` objects containing:
  - `current_value`: Mutable state for the current simulation step.
  - `sampler`: `GrowthSampler` initialized with the specific volatility model (e.g., Student's T, NRIG).

### Structure
- **Deterministic Run:** `run_iteration`
  - A single, linear pass through the timeline.
  - Used for the "base case" projection.
- **Stochastic Runs:** `run_monte_carlo_breadth_first`
  - **Strategy:** Breadth-First traversal. All trajectories (iterations) are advanced one month at a time.
  - **Reasoning:** Enables interaction between trajectories, specifically for the **Non-Ergodicity Pooling** logic.

### Logic Flow (Per Month)
1. **Operating Cash Flow:** Calculate Revenue -> Gross Profit -> Opex -> Net Income.
2. **Investment:** Apply treasury growth (Capital Growth Policy) to cash balance.
3. **Pooling (Stochastic Only):**
   - Calculate "Poolable Income" (Operating Profit + Investment Gain) for *all* trajectories.
   - Collect a fraction (`pooling_fraction`) from each trajectory into a central pool.
   - Redistribute the pool equally back to all trajectories.
4. **Dividends & Capital:** Apply dividend policies and inject external capital.
5. **Solvency Check:** Mark trajectory as insolvent if cash drops below credit facility limit.

### Output Structure
- **`SimulationResult`:**
  - `deterministic_data`: Full monthly history for the deterministic run.
  - `single_run_data`: Full monthly history for one representative stochastic run (usually the median).
  - `pXX_value`: Vectors of percentiles (P10, P50, P90) for the `total_value` metric over time.
  - `deterministic_valuation` / `deterministic_runway`: Summary metrics.

## 4. Database Strategy

### Connection Management
- **Pool:** `sqlx::PgPool` created in `main.rs`.
- **Configuration:** Max connections set to 5.
- **Sharing:** Passed to the Axum router via `.with_state(pool)`.

### Migrations
- **Tool:** `sqlx-cli` compatible.
- **Location:** `backend/migrations/`.
- **Execution:** Automated on application startup via `sqlx::migrate!("./migrations").run(&pool)`.

### ORM / Querying
- **Library:** `sqlx`.
- **Pattern:** compile-time checked queries using macros:  `sqlx::query_as!(Model, "SELECT ...")`
- **Mapping:** `FromRow` trait derives automatic mapping from DB columns to Struct fields.
