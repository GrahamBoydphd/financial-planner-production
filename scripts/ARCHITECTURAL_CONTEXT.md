# ARCHITECTURAL_CONTEXT.md
# Current Status: BUILD PHASE - UI & VISUALIZATION
# Last Updated: January 6, 2026

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

## 3. CURRENT FOCUS: UI LOGIC REFINEMENT
**Task:** Improve Dashboard UX by conditionally hiding irrelevant controls.

### Dynamic Control Visibility
* **The Issue:** The "Ergodicity Correction" (Pooling) slider is currently visible for all simulation types.
* **The Logic:** This parameter *only* applies to Non-Ergodic (Monte Carlo) simulations where volatility is being dampened. In deterministic/standard / single company models, it does nothing.
* **Requirement:**
    * **Watch State:** Track the selected `simulation_type` (e.g., 'standard' vs 'monte_carlo').
    * **Conditional Render:** Wrap the Slider component in a check.
    * **Behavior:**
        * If `Monte Carlo` -> **SHOW** Slider.
        * If `Standard (Average) /Safe/Single Path (Volatile)` -> **HIDE** Slider.

## 4. NEXT UP (PENDING)
* User Authentication (Login/Signup).
* PDF Export of Simulation Results.
