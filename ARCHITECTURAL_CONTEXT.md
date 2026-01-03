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

## 3. CURRENT FOCUS: REFACTORING & DASHBOARD FIXES
**Task:** Unify volatility inputs, fix dashboard navigation, and polish Dividend/Credit forms.

### A. Shared Components (`VolatilityInputs.tsx`)
* **Refactor:** Extract volatility fields (Type, Alpha, Beta, etc.) from Revenue/Expense/Treasury forms into `components/forms/shared/VolatilityInputs.tsx`.
* **UI:** Ensure input boxes in "Advanced Mode" are bottom-aligned (`flex items-end`).
* **Tooltips:** Standardize all help text across the platform.

### B. Dashboard & Navigation
* **Fix Buttons:**
    * `+ New Fund`: Open Fund Creation Modal or link to `/fund/new`.
    * `+ New Company` (Global): Link to `/company/new` (require Fund selection).
    * `+ Add Company` (Inside Fund Card): Link to `/company/new?fundId=...`.
* **Error Handling:** Prevent "Company not found" 404s on creation buttons.

### C. Specific Form Polish
* **Dividends:** Input as Percentage (0-100), store as Ratio (0-1). Tooltip: "% of surplus cash distributed."
* **Credit:** Add Toggle: "Annual Rate (APR)" vs "Monthly Rate". Frontend sends `is_annual_rate` bool.

## 4. NEXT UP (PENDING)
* User Authentication.
* UI Polish (Tooltips, specific menu re-ordering).
* Refining "Smart Fallback" for invalid mathematical inputs.
