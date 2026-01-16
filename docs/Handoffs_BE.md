Note that the dates below are in YYMMDD format and in reverse order, latest first. Alert me to any case of conflict; most likely the version coming first in this list, i.e., the most recent date, is the current version.


# 🚀 V3 Strategic Brief: High-Precision Multi-Entity Analytics

**Status:** Architecture Locked & Simulation-Ready

**Engine Version:** V3.0 (Hardened)

**Handover Target:** Strategist Agent (V4 Company and V2 Fund Planning Phase)

## 1. Core Simulation Upgrades

The financial engine has been refactored for institutional-grade precision, moving beyond simple linear growth to complex stochastic modeling.

- **NRIG & Advanced Distributions**: The engine now supports **Normal Reciprocal Inverse Gaussian (NRIG)** and **Student’s T** distributions for revenue, expenses, and treasury returns. This allows the strategist to model "fat-tail" risks and more realistic market volatility than standard normal distributions.

- **Breadth-First Monte Carlo**: We have transitioned the simulation to a breadth-first execution model. This enables complex interactions between different trajectories in a single run—specifically **Cash Pooling**.

- **Iterative Cash Pooling**: A new `pooling_fraction` parameter allows a designated percentage of net gains from across a portfolio of companies to be harvested into a central pool and redistributed equally. This provides a visualization of "Portfolio Insurance" and reduced insolvency risk at a fund level.


## 2. Operational Precision ("The Anniversary Fix")

The simulation of human capital has been updated to reflect real-world hiring and inflation patterns.

- **Hire-Date Anniversaries**: Salary inflation (`annual_increase_percent`) is no longer applied globally at the start of the year. It is now calculated per-role based on the specific month of hire, ensuring that a hire in Month 10 receives their first raise in Month 22.

- **Hiring Ramps**: Staffing roles now support sophisticated hiring plans, including `fixed_count` or `monthly_rate` (e.g., adding 1 employee every 3 months until a target is reached).


## 3. Data Integrity & "Fortress" Standards

To support V3's focus on capitalization, the underlying data contract has been hardened.

- **Unified Percentage Contract**: All growth and interest inputs system-wide (Revenue, Expenses, Staffing, Treasury, Debt) now use a standardized `_percent` field.

- **Whole-Number Inputs**: The engine now performs internal normalization (dividing by 100), meaning the API now expects raw percentage values (e.g., `3.0` for 3%) rather than decimal fractions (e.g., `0.03`).

- **Decimal Precision**: All financial transit uses string-based decimals to prevent floating-point rounding errors in multi-year, multi-trajectory runs.


## 4. Strategic Opportunities for V4 Company and V2 Funds

The Strategist Agent can now leverage these capabilities to design:

- **Multi-Company Funds**: Modeling multiple entities under a single fund, utilizing the new `companies` and `funds` table structures.

- **Dynamic Capitalization**: Modeling **Dividend Policies** (safety thresholds and payout ratios) alongside **Credit Facilities** (automated debt drawdown when cash hits zero).

- **Portfolio Resilience Analysis**: Comparing P10/P50/P90 outcomes across a fund to determine the optimal pooling fraction for portfolio survival.

# 🛡️ Evolutesix Financial Engine API Standards (V3 Hardened 260116)

## 1. The Percentage Standard
To ensure mathematical precision and prevent "compounding drift," all growth, return, and interest fields MUST be sent as **whole percentage numbers**. The Backend projection engine performs the division by 100 internally.

| Domain | API Field Key | Format | Example | Treatment |
| :--- | :--- | :--- | :--- | :--- |
| **Revenue** | `growth_rate_percent` | String | `"3.0"` | Monthly Growth / 100 |
| **Expenses** | `growth_rate_percent` | String | `"2.5"` | Monthly Growth / 100 |
| **Treasury** | `growth_rate_percent` | String | `"1.2"` | Monthly Return / 100 |
| **Staffing** | `annual_increase_percent` | String | `"3.0"` | Annual Inflation / 100 |
| **Debt** | `interest_rate` | String | `"8.0"` | Annual/Monthly Rate / 100 |

## 2. Data Types & Precision
* **Currency/Decimals**: MUST be transmitted as **Strings** (e.g., `"1250.50"`) to avoid floating-point rounding errors during JSON serialization.
* **Months**: Relative time markers MUST be **Integers** (e.g., Month 1, Month 12), not calendar dates.
* **UUIDs**: All resource IDs MUST be valid UUID v4.

## 3. String Normalization
All category and type indicators MUST be sent in **lowercase** to satisfy strict Backend matching logic.
* **Hiring Plans**: `fixed_count`, `monthly_rate`
* **Volatility**: `none`, `flat`, `student_t`, `nrig`
* **Frequency**: `monthly`, `annual`, `one-time`

## 4. Specific Business Logic
* **Staffing Anniversaries**: Salary increases are applied on the role's hire-anniversary month (calculated as `(m - role.start_month) / 12`), not at the start of a calendar year.
* **Negative Volatility**: The system explicitly supports negative volatility bounds (e.g., `vol_min: "-30.0"`).


## 🛡️ V3 Handoff: The "Fortress" Financial Engine 260115

**To:** Strategist Agent / Product Owner

**Status:** V3 Feature Complete & Hardened

**Primary Objective:** Transitioning from a basic projection tool to a high-precision Monte Carlo simulation engine with standardized financial controls.

### 1. Unified Financial Contract (The `_percent` Standard)

We have successfully renamed and standardized every growth and increase field across the system to ensure the Frontend and Simulation Engine speak the same language:

- **Revenue Items:** `growth_rate_percent` (Monthly growth).

- **Expense Items:** `growth_rate_percent` (Monthly growth).

- **Capital Growth:** `growth_rate_percent` (Monthly expected return).

- **Staffing Roles:** `annual_increase_percent` (Annual salary inflation).


### 2. Completed User Stories (V3)

- **Precision Volatility Models:** Implemented `Flat`, `Student's T`, and `NRIG` distributions for Revenue, Expenses, and Treasury.

- **Sophisticated Staffing:** Moved beyond simple headcount to a ramp-up model with `hiring_plan` types (`fixed_count`, `monthly_rate`) and annual inflation.

- **Treasury Management:** Integrated a Capital Growth Policy that allows cash balances to generate returns based on stochastic models.

- **Monte Carlo Pooling:** Developed a Breadth-First simulation engine that supports "Cash Pooling" across 1,000 iterations to visualize P50/P90 outcomes.

- **Operational Hardening:** Switched all financial inputs to `rust_decimal` for exact precision, preventing floating-point rounding errors in multi-year projections.


### 3. Critical Fixes & "Fine-Tunings"

- **The Anniversary Alignment:** Fixed the staffing logic in `projection.rs` so that salary raises occur on the individual's **hire-date anniversary** rather than the global plan start.

- **Input Hardening:** All API endpoints now strictly validate Enums (e.g., `frequency`, `source`, `volatility_type`) in **lowercase** to match Rust backend safety.

- **Volatility Bounds:** Restored the ability to input negative volatility (e.g., `vol_min: -30`) by wrapping decimal parsing in string-based DTOs.

- **Schema Synchronization:** Standardized the `capital_growth_policies` table to move expected returns from the legacy `vol_mean` column into the new `growth_rate_percent` column.


### 4. Remaining Architect's "Cleanup" List

While the engine is robust, the following tasks are queued for the next maintenance cycle:

- **Frontend Casing:** Ensure the "Edit" forms on the frontend lowercase their payload values before sending to the API.

- **Dead Code Removal:** Cleanup unused imports (`put`, `valuation`, `events`) and unused mutability warnings in `projection.rs`.

- **Authentication Finalization:** Enable the `Tenant` and `User` struct constructions once the login flow is fully wired.


---

### 🚀 Next Steps

The backend is now fully prepared for the Strategist Agent to define **V4: Advanced Capitalization and Multi-Entity Analytics**.

# Several authentication structs (`Tenant`, `User`, `RegisterRequest`) are not yet active in the current build.
