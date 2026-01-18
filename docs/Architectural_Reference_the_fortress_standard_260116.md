
From: Backend_Architect

To prepare Jules for a successful final audit, I have consolidated our "Fortress" engineering standards into a single reference document. This ensures Jules evaluates the code against our strict mathematical and architectural requirements.

### Clarification on P50 Logic and Cash Balance Trajectory

To ensure mathematical and visual consistency in the "Fortress" architecture, we have standardized how the median (P50) is calculated and displayed across the Monte Carlo simulation.

#### 1. The Cash Balance Line: Trajectory Definition

The "Median" line you see on the chart is **Option 2: The fictitious line connecting the middle value in each month**.

- **Statistical Basis**: For every month in the 120-month projection, the engine takes the 1,000 cash balance results and identifies the 500th value (the median) for that specific point in time.
    
- **Visual Logic**: This approach ensures that the "Median" line accurately represents what the "typical" cash balance looks like at any given moment, rather than being skewed by a single simulation run that might be median at the end but an outlier in the beginning.
    
- **Path Dependency**: This "fictitious" line is the standard representation for Monte Carlo medians because a single "middle path" (Option 1) often does not exist; a simulation that is median in Month 12 might be in the P90 tier by Month 24 due to a late-stage growth spike.
    

#### 2. P50 Valuation and Runway: Final Confirmations

We have calibrated these metrics to align with the **P50 Cash Trajectory** described above to prevent visual disconnects in the UI.

| **Metric**          | **Calculation Basis**                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Runway (P50)**    | This is the first month where the **P50 Cash Line** (the fictitious line) hits zero or less. It is **not** the median of the 1,000 individual death dates.                                                                                                    |
| **Valuation (P50)** | This is calculated using the final-month financial metrics (e.g., Revenue/EBITDA) of the **P50 Trajectory**. By deriving it from the median path's endpoint, the "EST Valuation" label on the chart will exactly match the performance shown on the P50 line. |
| **Net Value (P50)** | This represents the final cash plus accumulated dividends specifically for the **median outcome path** at the end of the 120-month projection.                                                                                                                |
### 📘 Architectural Reference: The Fortress Standard (V3.0)

**1. Mathematical Integrity (Decimal vs. Float)**

- **The Rule:** All financial variables (Currency, Growth Rates, Interest, Tax) must use `rust_decimal::Decimal`.
    
- **The Reason:** To prevent floating-point "drift" and precision loss in long-term Monte Carlo simulations.
    
- **The Percentage Standard:** Percentages must be accepted as raw numbers (e.g., `3.0` for 3%) and divided by `dec!(100.0)` only within the projection loop.
    

**2. Audit & Integrity (Timestamps & Explicit Queries)**

- **Metadata:** Every core financial table must have a non-nullable `created_at: DateTime<Utc>` field.
    
- **Explicit SQL:** The use of `SELECT *` is strictly forbidden in `sqlx::query_as!` macros.
    
- **Query Safety:** Use the "Force Non-Null" syntax (e.g., `created_at as "created_at!"`) when the SQLx macro incorrectly infers nullability from the database schema.
    

**3. Statistical Single Source of Truth**

- **Monte Carlo Paths:** The "P50" metrics (Valuation, Runway, Net Value) must be derived from the **median simulation trajectory**, not the average of final results.
    
- **Visual Alignment:** The labels in the UI must exactly match the path plotted on the chart line.
    

# 🛡️ Fortress Standard V3.0: Technical Integrity & Audit
**Status**: Hardened | **Date**: 2026-01-16

## 1. Mathematical Standards
* **Decimal Enforcement**: All financial paths must use `rust_decimal::Decimal`. Purge all `f64` from handlers.
* **Percentage Input**: Percentages are raw (e.g., 3.0 = 3%) and divided by `dec!(100.0)` in the engine.
* **P50 Alignment**: Labels (Runway, Valuation) must derive from the monthly median cash trajectory.

## 2. Database & Model Standards
* **Audit Metadata**: All core tables require a non-nullable `created_at: DateTime<Utc>`.
* **Explicit SQL**: No `SELECT *`. Every query must explicitly list columns with "Force Non-Null" `!` syntax where needed.
* **Naming**: Fields must be scoped: `valuation_name`, `role_name`, `event_name`.

## 3. Audit Instructions
* **Zero-Defect Scan**: Grep for `f64`, `SELECT *`, and `#` comments.
* **SQLx Sync**: Execute `cargo sqlx prepare` to lock the metadata cache.
---

### 📋 Handoff Instructions for Jules

Jules, you are tasked with a **Zero-Defect Audit** of the current repository. Your goal is to ensure 100% compliance with the Fortress Standard before we transition to the V3 Strategist phase.

**Phase 1: Static Analysis**

1. **Grep for `f64`:** Search all `backend/src/handlers/` and `backend/src/projection.rs`. Flag any instances not required by external statistical libraries.
    
2. **Scan for Wildcards:** Identify any `SELECT *` remaining in SQL queries.
    
3. **Check Comment Syntax:** Ensure no SQL files or Rust `r#""#` literals contain `#` for comments; replace them with `--`.
    

**Phase 2: Logic Validation**

1. **Projection Pathing:** Verify in `projection.rs` that the P50 Net Value and P50 Runway are calculated using the first month where the median cash trajectory hits the threshold.
    
2. **Naming Audit:** Ensure all "name" fields are scoped (e.g., `valuation_name`, `role_name`, `event_name`).
    

**Phase 3: Final Certification**

1. Run `./scripts/try_build.sh` and resolve any remaining warnings.
    
2. Execute `cargo sqlx prepare` to lock the metadata.