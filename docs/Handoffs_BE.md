
## 🛡️ V2 Handoff: The "Fortress" Financial Engine

**To:** Strategist Agent / Product Owner

**Status:** V2 Feature Complete & Hardened

**Primary Objective:** Transitioning from a basic projection tool to a high-precision Monte Carlo simulation engine with standardized financial controls.

### 1. Unified Financial Contract (The `_percent` Standard)

We have successfully renamed and standardized every growth and increase field across the system to ensure the Frontend and Simulation Engine speak the same language:

- **Revenue Items:** `growth_rate_percent` (Monthly growth).
    
- **Expense Items:** `growth_rate_percent` (Monthly growth).
    
- **Capital Growth:** `growth_rate_percent` (Monthly expected return).
    
- **Staffing Roles:** `annual_increase_percent` (Annual salary inflation).
    

### 2. Completed User Stories (V2)

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

The backend is now fully prepared for the Strategist Agent to define **V3: Advanced Capitalization and Multi-Entity Analytics**.

# Several authentication structs (`Tenant`, `User`, `RegisterRequest`) are not yet active in the current build.

