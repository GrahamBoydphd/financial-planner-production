# ARCHITECTURAL_CONTEXT.md
# Current Status: BUILD PHASE - Staffing Module
# Last Updated: [Current Date]

## 1. PROJECT GOAL
**Objective:** Build a financial simulation engine capable of non-ergodic (Monte Carlo) analysis for startups.
**Core Philosophy:** Avoid "average of averages." Simulate path-dependent volatility using specific distributions (Normal, Student's T, NRIG).

## 2. ESTABLISHED CONSTRAINTS (DO NOT CHANGE)
* **Tech Stack:**
    * **Backend:** Rust (Axum, SQLx, Tokio).
    * **Database:** PostgreSQL (SQLx for compile-time checked queries).
    * **Frontend:** Next.js (TypeScript, React, Tailwind CSS).
    * **Math:** `rust_decimal` for all currency calculations. No floating point money.
* **Core Engine (`backend/src/projection.rs`):**
    * The simulation loop calculates month-by-month cash flow.
    * It handles: Revenue, COGS, OpEx, Capital Injections, Dividends, and Credit Facilities.
    * **Monte Carlo:** Runs 1000+ iterations if enabled, calculating percentiles (P5, P50, P95).
    * **Logic:** Insolvency logic stops simulation if cash < -credit_limit.
* **Visualization:**
    * Fan Charts (`CashFlowChart.tsx`) visualize the P5-P95 spread.
    * Supports both Logarithmic and Linear scales.

## 3. CURRENT FOCUS: NON-ERGODICITY MODULE (BREADTH-FIRST REFACTOR)
**Task:** Implement "Fractional Profit Pooling" to correct for non-ergodicity, requiring a rewrite of the simulation engine from Depth-First to Breadth-First.

### A. Database & Models
* **New Field:** `pooling_fraction` (Decimal, Default 0.0) in `financial_plans` table.
* **Struct:** Update `FinancialPlan` in `backend/src/models.rs`.

### B. Simulation Engine Rewrite (`backend/src/projection.rs`)
* **Current Logic (Depth-First):** `for trajectory in 0..I { for month in 0..M { ... } }` -> **INCORRECT** for pooling.
* **New Logic (Breadth-First):**
    1. Initialize Vector of `TrajectoryState` size I (e.g., 1000).
    2. `for month in 0..M`:
        * `pool_this_month = 0.0`
        * **Phase 1 (Calculate):** Iterate all I states. Calculate Net Income.
            * If `Income > 0`: `contribution = Income * pooling_fraction`.
            * `pool_this_month += contribution`.
            * `state.cash += Income - contribution`.
            * Else: `state.cash += Income`.
        * **Phase 2 (Distribute):** `share = pool_this_month / I`.
        * Iterate all I states: `state.cash += share`. `state.total_pool_received += share`.
    3. **Aggregation:** Once month loop finishes, compile stats (P50, P90) from the vector of states.

### C. Frontend
* **UI:** Add Slider "Non-Ergodicity Correction" (0-100%) in `AdvancedSettings` or similar.
* **Chart:** Add "Accumulated Pool Share" to the breakdown if possible, or just ensure Cash Balance reflects the smoothing.

## 4. NEXT UP (PENDING)
* User Authentication.
* UI Polish (Tooltips, specific menu re-ordering).
* Refining "Smart Fallback" for invalid mathematical inputs.
