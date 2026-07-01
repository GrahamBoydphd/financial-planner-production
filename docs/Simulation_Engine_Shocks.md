

# 📖 The Simulation Engine: How Your Inputs Drive the Math

This guide explains the underlying mathematical logic of the Monte Carlo simulation engine. It details exactly how frontend inputs (like "Small" magnitudes or "Heavy" fatness) are translated into the hard numbers that drive your financial projections.

## 1. How Events (Shocks) Actually Work

The Event Manager is a stochastic (probabilistic) engine. When you create an Event, the backend does not just apply a flat number; it generates a dynamic scenario based on your parameters.

### A. Probability (When does it happen?)

You input an **Annual Likelihood (e.g., 20%)**.

The backend converts this into a **Monthly Probability** using the following formula to ensure the math compounds correctly over the year:

$P_{monthly} = 1 - (1 - P_{annual})^{\frac{1}{12}}$

Every single month of the simulation, the engine rolls a digital die. If the roll falls within that monthly probability, the event triggers.

### B. Magnitude (How big is the impact?)

You can input an exact percentage (e.g., "15") or use a category (Small, Medium, Large, Catastrophic).

The backend treats your input as the **Mean** of a Normal (Bell Curve) Distribution, with the standard deviation automatically set to 20% of the mean.

- **Small:** Centered at 10% (± 2%)
    
- **Medium:** Centered at 30% (± 5%)
    
- **Large:** Centered at 50% (± 10%)
    
- **Catastrophic:** Centered at 80% (± 15%)
    
- _Note: Every time the event triggers, it rolls a slightly different actual severity based on this curve._
    

### C. Direction (Is it good or bad?)

The backend applies your magnitude based on the chosen direction:

- **Detrimental / Beneficial:** 100% chance to be strictly negative or strictly positive.
    
- **Neutral:** A 50/50 coin flip between positive and negative impact.
    
- **Biased (Detrimental/Beneficial):** A 75% chance to hit the primary direction, and a 25% chance to hit the opposite direction at a reduced severity.
    

### D. Duration & Proration (How long does it last?)

If you select a category instead of an exact number of months, the backend randomizes the duration:

- **Short:** 1 to 4 months.
    
- **Medium:** 4 to 8 months.
    
- **Long:** 8 to 24 months.
    

**How the impact is applied over time:**

- **Flow Metrics (Revenue / Opex / COGS):** The impact is applied in full for _every month_ of the duration. (e.g., a 20% revenue hit lasting 3 months means revenue is reduced by 20% in Month 1, Month 2, and Month 3).
    
- **Stock Metrics (Cash Balances):** The impact is **prorated**. If an event dictates a 30% hit to cash reserves over 3 months, the backend drains exactly 10% per month.
    
- _Warning:_ Detrimental cash shocks applied to a company already in debt will _increase_ their debt. There are no magical bailouts.
    

### E. Counter-Cyclic vs. Correlated (Who gets hit?)

If an event targets multiple companies (or the whole fund):

- **Correlated (Standard):** The engine rolls the severity and duration _once_. Every targeted company suffers the exact same impact at the exact same time.
    
- **Counter-Cyclic:** The engine rolls the severity and duration _independently_ for every single company. One company might take a massive hit, while another takes a mild hit or even benefits.
    

## 2. Volatility & Distributions (NRIG)

When you set volatility on Revenue, Expenses, or Capital Growth, the backend defaults to the **NRIG (Normal-Reciprocal Inverse Gaussian)** distribution. This is a "heavy-tailed" model designed to simulate real-world financial markets, where extreme events happen more often than a standard bell curve predicts.

- **Fatness (Alpha):** Controls how likely extreme "black swan" events are.
    
    - _Skinny_ = Highly predictable.
        
    - _Heavy_ = Extreme outliers are common.
        
- **Skew (Beta):** Controls the asymmetry of the curve.
    
    - _Strong Downside_ = The worst outliers will be negative (e.g., market crashes).
        
    - _Strong Upside_ = The best outliers will be positive (e.g., viral growth).
        
- **Width (Scale/Delta):** Controls the general day-to-day variance around the target mean.
    

_Safety Net:_ If the backend receives an unrecognized typo for any of these fields from the frontend, it safely defaults to "Normal" fatness, "Symmetric" skew, and "Medium" width to prevent the simulation from crashing.

## 3. Structural Fund Mechanics

### Ergodicity Correction (Pooling Fraction)

When you move the Ergodicity slider on the frontend, it overrides the `pooling_fraction` saved in the database.

- **How it works:** If a company generates positive net cash flow in a month, the backend taxes that _new gain_ by the pooling fraction (e.g., 20%). That taxed cash goes into a central pot, which is immediately distributed evenly to all surviving companies in the fund, acting as a structural safety net.
    

### The Reaper (Insolvency)

A company is declared dead if its `current_cash` drops below its `insolvency_threshold`.

- **Credit Facilities:** If a company has a credit facility, the backend dynamically lowers the insolvency threshold by the facility limit. (e.g., If the threshold is $0, but the company has a $1M credit limit, the Reaper will not kill the company until it hits -$1M).
    
- Once a company dies, its cash balance is frozen (preserving its final debt for fund-level exposure calculations), and its revenues and expenses flatline to zero.
    

### Soft Limits (Friction Tax)

If activated, this acts as a tax on extreme hoarding. If a company's cash balance exceeds the `soft_limit_threshold`, the backend applies the `soft_limit_fraction` to the _excess_ amount and removes it from the simulation (simulating capital inefficiency, forced distributions, or inflation drag).

