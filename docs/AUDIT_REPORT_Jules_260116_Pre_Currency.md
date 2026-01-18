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
