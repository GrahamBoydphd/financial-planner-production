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

## 3. CURRENT FOCUS: 


## 4. NEXT UP (PENDING)

