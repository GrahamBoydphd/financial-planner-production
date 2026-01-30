
# 💎 Master Architectural Reference: The Fortress Standard (V3)

**Status**: Hardened | **Date**: 2026-01-16 | **Target**: Frontend & Backend Architects
**Core Mission**: To maintain 100% mathematical integrity and structural consistency across the Evolutesix Financial Engine.

## 1. TECHNOLOGY STACK (Immutable)

The stack is selected for institutional-grade precision, type safety, and high-performance simulation execution.

* **Backend:**
    * **Language:** Rust (Edition 2021).
    * **Web Framework:** `axum` (with `tokio`).
    * **Database:** PostgreSQL via `sqlx` (Compile-time checked queries).
    * **Math:** See Immutable Data Contract below.
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

### The "Solvency Source of Truth"

- **Removed:** The `is_insolvent` boolean flag has been **permanently deleted** from the API to prevent "split-brain" states.
    
- **New Standard:** You must exclusively use `is_solvent: boolean`.
    
- **Logic:**
    
    - If `is_solvent === true`: Company is trading.
        
    - If `is_solvent === false`: Company is dead. All financial fields (Revenue, Cash, Opex) are guaranteed to be `0.00`.


--- 

# 📡 API Contract: Fund Simulation (V3.1)

**Status:** Live | **Endpoint:** `GET /api/funds/{fund_id}/simulation` | **Strictness:** Hardened

|**Direction**|**Component**|**Type**|**Description**|
|---|---|---|---|
|**Request**|`fund_id`|**Path** (UUID)|The ID of the Fund you are viewing.|
||`fund_plan_id`|**Query** (UUID)|**Optional.** The ID of the saved configuration.<br><br>  <br><br>If omitted, defaults to "Latest Plan" for every company.|
||`stop_insolvency`|**Query** (Bool)|**Optional.** If `true`, stops simulation for a company/universe if it goes insolvent (defaults to `false`).|
|**Response**|`labels`|**Array** `[String]`|X-Axis labels (e.g., "Month 1", "Month 2").|
||**Fan Chart**||**The 7 Statistical Bands** (Total Fund Value)|
||`p0_value`|**Array** `[Decimal]`|**Minimum** (Worst Case / Floor).|
||`p10_value`|**Array** `[Decimal]`|10th Percentile (Conservative).|
||`p25_value`|**Array** `[Decimal]`|25th Percentile.|
||`p50_value`|**Array** `[Decimal]`|**Median** (Baseline).|
||`p75_value`|**Array** `[Decimal]`|75th Percentile.|
||`p90_value`|**Array** `[Decimal]`|90th Percentile (Optimistic).|
||`p100_value`|**Array** `[Decimal]`|**Maximum** (Best Case / Ceiling).|
||**Solvency Detail**||**Structural Health** (Active Companies per Percentile)|
||`p0_solvent_count`|**Array** `[Integer]`|The count of solvent companies in the P0 scenario.|
||`p10_solvent_count`|**Array** `[Integer]`|The count of solvent companies in the P10 scenario.|
||`p25_solvent_count`|**Array** `[Integer]`|The count of solvent companies in the P25 scenario.|
||`p50_solvent_count`|**Array** `[Integer]`|The count of solvent companies in the P50 scenario.|
||`p75_solvent_count`|**Array** `[Integer]`|The count of solvent companies in the P75 scenario.|
||`p90_solvent_count`|**Array** `[Integer]`|The count of solvent companies in the P90 scenario.|
||`p100_solvent_count`|**Array** `[Integer]`|The count of solvent companies in the P100 scenario.|
||**Cliff Chart**||**Survival Probability**|
||`survival_rate`|**Array** `[Decimal]`|% of universes with at least one solvent company (`0.0` - `1.0`).|
||**Interaction**||**Instant "Next Path" Data**|
||`all_paths`|**Array** `[[Decimal]]`|**The 1,000 Runs.** A list of arrays. Each inner array is one full simulation path of the Fund Value.|
||**Reference**||**Benchmarks**|
||`deterministic_data`|**Array** `[Object]`|The "Perfect Average" run (Zero Volatility). Returns full monthly details.|
||`p50_data`|**Array** `[Object]`|The **Detailed Median Run**. Use this for the Data Table (shows Revenue, Opex, Cash, etc.).|

---

### 📊 The `p50_data` Structure (Financial Table Source)

The `p50_data` key provides the "Median Fund Scenario." Unlike the simple arrays used for charts (like `p50_value`), this is an array of objects designed to power a detailed **Financial Statement Table**.

|**Field**|**Type**|**Description**|
|---|---|---|
|`month_index`|`i32`|The sequence number of the month (1, 2, 3...).|
|`date`|`String`|The formatted date label (e.g., "Month 1").|
|`revenue`|`Decimal`|Aggregated revenue across all companies in the median universe.|
|`opex`|`Decimal`|Aggregated operating expenses across all companies in the median universe.|
|`net_income`|`Decimal`|The total profit/loss (including pool distributions and gains).|
|`cash_balance`|`Decimal`|The total liquidity available in all fund companies combined.|
|`cumulative_pool_received`|`Decimal`|The total amount of internal capital redistributed via the pooling logic.|
|`total_value`|`Decimal`|The core metric: `Cash + Cumulative Dividends`.|
|`is_solvent`|`Boolean`|Flag indicating if at least one company in the fund is still alive.|
|`total_companies`|`i32`|The total count of companies in the fund at the start.|
|`solvent_companies`|`i32`|The number of companies remaining solvent in that specific month.|
|`cumulative_dividends`|`Decimal`|The sum of all dividends distributed by all fund companies up to that month.|
|`total_investment`|`Decimal`|The aggregated `cumulative_external_capital` for the fund.|

---

### 📦 JSON Response Example

JSON

```
{
  "labels": ["Month 0", "Month 1", "Month 2"],

  // 📉 1. The Fan Chart (7 Bands - Financial)
  "p0_value":   [100000, 95000, 90000],
  "p10_value":  [100000, 98000, 96000],
  "p25_value":  [100000, 100000, 102000],
  "p50_value":  [100000, 105000, 108000],
  "p75_value":  [100000, 110000, 115000],
  "p90_value":  [100000, 120000, 130000],
  "p100_value": [100000, 150000, 180000],

  // 🏛️ 2. The Structure Chart (7 Bands - Solvency Counts)
  // MANDATORY: Will always be present, even if empty arrays (though labels implies data).
  "p0_solvent_count":   [5, 4, 2],
  "p10_solvent_count":  [5, 5, 4],
  "p25_solvent_count":  [5, 5, 5],
  "p50_solvent_count":  [5, 5, 5],
  "p75_solvent_count":  [5, 5, 5],
  "p90_solvent_count":  [5, 5, 5],
  "p100_solvent_count": [5, 5, 5],

  // ☠️ 3. The Cliff Chart
  "survival_rate": [1.0, 0.99, 0.95], 

  // ⚡ 4. The "Next Path" Data (1,000 Arrays)
  "all_paths": [
    [100000, 102340, 98000],  // Universe 1
    [100000, 99000, 105000],  // Universe 2
    [100000, 150000, 200000]  // Universe 3 ... up to 1000
  ],

  // 📊 5. Table Data (Detailed Median)
  "p50_data": [
    {
      "month_index": 1,
      "date": "Month 1",
      "revenue": "50000.0",
      "opex": "40000.0",
      "cash_balance": "105000.0",
      "total_value": "105000.0",
      "solvent_companies": 5,
      "total_companies": 5,
      "is_solvent": true
    }
  ]
}
```
 
### 💡 Frontend Implementation Hints

1. **"Next Path" Button:**
    
    - Do **not** call the API again.
        
    - Create a local state: `const [pathIndex, setPathIndex] = useState(0)`.
        
    - On Click: `setPathIndex((prev) => (prev + 1) % data.all_paths.length)`.
        
    - Plot: `data.all_paths[pathIndex]`.
        
2. **Total Value Definition:**
    
    - The charts plot **Fund Total Value**.
        
    - Formula: $\sum(\text{Company Cash}) + \sum(\text{Dividends Paid})$.
        
    - _Note:_ This means the chart line won't drop simply because a dividend was paid out; it captures the wealth creation.

---

## Swan Events

Here is the complete reference list of the exact values and options the Frontend now sends to the Backend for a `SwanEvent`. This includes the **Semantic Strings** (words instead of numbers) and the **Formatting Fixes** (percentages) we implemented today.

### 1. Magnitude (Impact Size)

_Previously sent as numbers (`0.10`), now sent as semantic words:_

- `"small"` (10% impact)
    
- `"medium"` (30% impact)
    
- `"large"` (50% impact)
    
- `"catastrophic"` (80% impact) — _Added per your request._
    

### 2. Duration (Time Span)

_Previously sent as months (`3`), now sent as semantic words:_

- `"short"` (1-4 months)
    
- `"medium"` (4-8 months)
    
- `"long"` (8-24 months)
    

### 3. Direction (Who wins/loses)

- `"detrimental_only"` (Bad for everyone)
    
- `"beneficial_only"` (Good for everyone)
    
- `"both_neutral"` (Mixed bag, net neutral)
    
- `"both_biased_detrimental"` (Mixed, but mostly bad)
    
- `"both_biased_beneficial"` (Mixed, but mostly good)
    

### 4. Scope & Targets

- **Scope:** `"local"` or `"global"`
    
- **Target IDs:** An array of UUID strings `["uuid-1", "uuid-2"]`.
    
    - If Global: These are Fund IDs.
        
    - If Local: This is a Company ID.
        

### 5. Probability (Likelihood)

- **Format:** Sent as a whole number string representing the percentage.
    
- **Example:** `"50"` (represents 50%).
    
    - _Correction:_ We no longer send `"0.5"`.
        

### 6. New: Distribution (Counter-Cyclic)

_Only sent for Global + "Both" directions:_

- **Field:** `is_counter_cyclic`
    
- **Value:** `true` or `false`
    
    - `false` (Default): All companies react the same way (Unified).
        
    - `true`: Companies are split between positive and negative reactions based on the bias.
        

### 7. Event Type

- `"revenue_shock"`
    
- `"expense_shock"`
    
- `"valuation_shock"`
    

### 8. Event Name

- A standard text string (e.g., `"Market Crash 2026"`).

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

#### 7.1 Company Level

The Frontend Architect must ensure the UI accurately reflects the Engine's stochastic capabilities:

- **P50 Trajectory (The Median) in any Monte Carlo simulation**: The "Median" line on charts is a fictitious path connecting the 500th value (of 1,000 simulations) for **each individual month**.
    
- **Visual Alignment**: UI labels for Runway and Valuation must be derived from this specific monthly median trajectory to ensure the data matches the line graph.
    
- **Relative Time**: The system uses **Integers** for months (e.g., Month 1, Month 12) rather than calendar dates.
    
- **Staffing Anniversaries**: Salary increases are applied on the role's hire-anniversary month, calculated as `(m - role.start_month) / 12`, not at the start of a calendar year.
    
- **Negative Volatility**: The UI must support and transmit negative bounds for volatility (e.g., `vol_min: "-30.0"`).


#### 7.2 Fund Level

The Frontend Architect must ensure the UI accurately reflects the Engine's stochastic capabilities:

- **P50 Trajectory (The Median) in any Monte Carlo simulation**: The "Median" line on charts is a fictitious path connecting the 500th value (of 1,000 simulations) for **each individual month**.
    
- **Visual Alignment**: UI labels must be derived from this specific monthly median trajectory to ensure the data matches the line graph.
    
- **Relative Time**: The system uses **Integers** for months (e.g., Month 1, Month 12) rather than calendar dates.
    
- **Any Anniversaries within a fund or within a company in the fund**: Annual changes are applied in the anniversary month, calculated as `(m - role.start_month) / 12`, not at the start of a calendar year.
    
- **Negative Volatility**: The UI must support and transmit negative bounds for volatility (e.g., `vol_min: "-30.0"`).


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
    

---

# Lifecycle Management & Templates

## 1. API Contract (Lifecycle)

### A. Duplicate a Plan

- **Endpoint:** `POST /api/lifecycle/plans/{id}/duplicate`
    
- **Action:** Deep copies the plan and all its children (Revenue, Staffing, etc.) to the **same** company.
    
- **Body:** `null` (Empty)
    
- **Response:** `200 OK` -> Returns the _newly created_ Plan object.
    

### B. Duplicate a Company

- **Endpoint:** `POST /api/lifecycle/companies/{id}/duplicate`
    
- **Action:** Deep copies the company and **all** its plans/scenarios to the **same** fund.
    
- **Body:** `null` (Empty)
    
- **Response:** `200 OK` -> Returns the _newly created_ Company object.
    

### C. Duplicate a Fund

- **Endpoint:** `POST /api/lifecycle/funds/{id}/duplicate`
    
- **Action:** Deep copies the fund, all companies, and all plans.
    
- **Body:** `null` (Empty)
    
- **Response:** `200 OK` -> Returns the _newly created_ Fund object.
    
- **⚠️ Note:** This is the heaviest operation. **Expect 5-10 second latency.**
    

### D. Move a Company

- **Endpoint:** `PUT /api/lifecycle/companies/{id}/move`
    
- **Action:** Moves a company from its current fund to a target fund.
    
- **Body:**
    
    JSON
    
    ```
    {
      "target_fund_id": "uuid-of-new-parent-fund"
    }
    ```
    
- **Constraint:** Target fund must belong to the same Tenant.
    

---

## 2. API Contract (Demo Library)

### E. Get Public Templates

- **Endpoint:** `GET /api/lifecycle/templates`
    
- **Action:** Returns a list of "ReadOnly" funds created by the Demo Admin.
    
- **Response:** `200 OK` -> `[ { "id": "...", "name": "SaaS Demo Fund", "is_public_template": true, ... } ]`
    

### F. Clone Template (Import)

- **Endpoint:** `POST /api/lifecycle/templates/{id}/clone`
    
- **Action:** Copies the public template into the **current user's** tenant as a private, editable fund.
    
- **Body:** `null`
    
- **Response:** `200 OK` -> Returns the new private Fund object.
    

---

## 3. UI/UX Requirements

### 1. Structure Page (Tree View)

- **Context Menus:** Add a `...` menu to every node in the tree.
    
    - **Fund Node:** `[ Duplicate Fund ]`
        
    - **Company Node:** `[ Duplicate Company ]`, `[ Move to... ]`
        
    - **Plan Node:** `[ Duplicate Plan ]`
        
- **"Move" Modal:**
    
    - When "Move to..." is clicked, fetch the list of _all_ funds (`GET /api/funds`).
        
    - Filter out the _current_ parent fund.
        
    - Let user select target -> Confirm -> Call API.
        

### 2. Dashboard Page

- **Templates Tab:** Add a new tab called "Templates" or "Demo Library" next to "My Funds".
    
- **Card Actions:**
    
    - **My Funds:** Add "Duplicate" button to the fund cards.
        
    - **Templates:** Add "Import to My Funds" button (calls `/clone`).
        


## 11. Recorded Micro-Decisions

_These are specific implementation details agreed upon in this chat that refine the broader rules in the document._

1. **P50 Runway = "Remaining Time"**: We refined the P50 Runway logic so that if the median trajectory is insolvent, the runway explicitly returns `0` (instead of the month-index of death). This aligns with the "time to live" semantic.
    
2. **Retention of `valuation_name`**: We explicitly decided **not** to rename `valuation_name` to `assumption_name` (as I initially proposed), preferring to keep the semantic specificity for now. This complies with the "Scoped Naming" rule (it is scoped) but avoids over-abstraction.
    
3. **Staffing "Role Name"**: We specifically applied the scoped naming rule to `StaffingRole` ($\rightarrow$ `role_name`) and `EventShock` ($\rightarrow$ `shock_name`), which were the final holdouts from the "Master Fortress Standard" audit.