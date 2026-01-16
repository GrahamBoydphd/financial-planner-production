# Fortress Standard V2.0 Audit Report

## Phase 1: Static Analysis

### 1. `f64` Usage
**Status**: Partial Compliance
- **Findings**:
  - `backend/src/projection.rs`: `f64` is used for converting `Decimal` to/from `f64` for the `VolatilityModel` (which presumably requires `f64` for statistical distributions like `statrs`). This is permitted by "required by external statistical libraries".
  - `backend/src/projection.rs`: `let idx_10 = (iterations as f64 * 0.10) as usize;` used for percentile indices. This is safe but could be integer math.
- **Recommendation**: Accept current usage as compliant/necessary, or refactor percentile calculation to integer math for strictness.

### 2. Wildcards (`SELECT *`)
**Status**: **FAIL**
- **Findings**:
  - `backend/src/handlers/valuation.rs`: `SELECT * FROM valuation_assumptions` in `get_valuation_assumption`.
  - `backend/src/handlers/valuation.rs`: `INSERT INTO ... RETURNING *` in `upsert_valuation_assumption`.
- **Recommendation**: Replace with explicit column lists immediately.

### 3. Comment Syntax (`#`)
**Status**: Pass
- No issues found in `.sql` or `.rs` files.

## Phase 2: Logic Validation

### 1. Projection Pathing (P50 Logic)
**Status**: **FAIL** (Visual Alignment)
- **Backend Logic**: `projection.rs` correctly identifies the "median simulation trajectory" (simulation with median final value) and derives `p50_valuation` and `p50_runway` from it. This complies with "Single Source of Truth".
- **Frontend Logic**: `frontend/app/plan/[planId]/results/page.tsx` constructs the P50 table by taking `deterministic_data` (Average Run) and overriding `total_value` with `p50_value` (Path of Medians).
  - **Issue**: The table rows are inconsistent. `revenue`, `expenses`, `dividends` come from the Average Run, while `total_value` comes from the Path of Medians. The P50 metrics (`valuation`, `runway`) come from the Median Trajectory.
  - **Standard Violation**: "Visual Alignment: The labels in the UI must exactly match the path plotted on the chart line." AND "Statistical Single Source of Truth". The table is a mix of three different sources.
- **Recommendation**:
  - Ensure the frontend uses `single_run_data` (Median Trajectory) when in Monte Carlo mode for both the chart and the table.
  - Alternatively, if the "Path of Medians" is desired for the chart, ensure the table and metrics consistently reflect that, but the Standard prefers "Median Simulation Trajectory".

### 2. Naming Audit (Scoped Names)
**Status**: **FAIL**
- **Findings**:
  - `FinancialPlan`: uses `name`. Expected: `plan_name`.
  - `RevenueItem`: uses `name`. Expected: `revenue_name`.
  - `ExpenseItem`: uses `name`. Expected: `expense_name`.
  - `CapitalInjection`: uses `name`. Expected: `injection_name`.
  - `Company`: uses `name`. Expected: `company_name`.
  - `Fund`: uses `name`. Expected: `fund_name`.
- **Compliant**:
  - `ValuationAssumption`: uses `valuation_name`.
  - `StaffingRole`: uses `role_name`.
  - `EventShock`: uses `event_name`.
- **Recommendation**: Rename columns in database and update all corresponding code (Models, Handlers, Frontend) to use scoped names.

### 3. Hardening & Cleanup
- **Findings**:
  - `backend/src/handlers/financials.rs.bak` exists.
- **Recommendation**: Delete the backup file.

## Summary
The codebase requires remediation to meet the Fortress Standard, particularly regarding **Explicit SQL** and **Scoped Naming**. The **P50 Visual Alignment** issue in the frontend also requires attention to ensure the "Single Source of Truth" principle is upheld.
