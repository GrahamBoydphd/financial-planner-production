# USER_MANUAL_TECHNICAL_REF.md

This document provides a technical reference for the user manual, detailing input fields, simulation parameters, and UI logic within the application.  It's geared toward technical users who need a deeper understanding of the platform's functionality.

## 1. Input Field Glossary

This section provides a comprehensive glossary of input fields used throughout the application forms.  Each entry includes the field label, its purpose, and any validation rules applied.

### Staffing Form

| Label                      | Purpose                                                           | Validation Rules                                                                                               |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Role Name                  | Title of the position (e.g., 'Sales Rep', 'Developer').           | Required, must not be empty.                                                                                  |
| Annual Salary              | Base annual salary per person in this role.                      | Required, must be a valid number.                                                                            |
| Hiring Plan                | How employees are added over time (Fixed Count or Monthly Rate). | Select from dropdown: "fixed_count" or "monthly_rate".                                                        |
| Target Headcount           | Maximum number of people to hire for this role.                  | Required, must be an integer greater than or equal to 1.                                                      |
| Hiring Pace (Months per Hire) | Hire 1 person every X months. (e.g., 1 = monthly, 3 = quarterly).| Required if Hiring Plan is "monthly_rate", must be an integer greater than or equal to 1.                          |
| Start Month                | Month number (1-60) when hiring begins.                         | Required, must be an integer between 1 and 60 (inclusive).                                                    |
| Annual Increase (%)        | Expected annual salary increase (e.g., 3.5 for 3.5%).             | Optional, must be a number between 0 and 100 (inclusive). Displayed to the user with a percentage symbol. |

### Revenue Form

| Label                  | Purpose                                              | Validation Rules                                                                                    |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Name                   | Name of the revenue stream (e.g., SaaS Subs).        | Required, must not be empty.                                                                      |
| Source Type            | Category of revenue (e.g., Sales, Subscription).    | Select from dropdown: Sales, Subscription, Service, Other.                                       |
| Initial Amount ($)     | Starting revenue amount.                            | Required, must be a valid number.                                                                |
| Growth Rate (%/mo)     | Monthly growth rate percentage.                     | Optional, must be a valid number.                                                                |
| Cost of Rev (%)    | Cost of revenue percentage.                       | Optional, must be a valid number.                                                               |
| Frequency              | How often revenue is recognized (e.g., Monthly).    | Select from dropdown: Monthly, One-time, Quarterly, Annually.                                     |
| Start Month            | Month in which revenue stream begins.                | Required, must be a valid number.                                                                |
| End Month (Opt)          | Month in which revenue stream ends (optional).    | Optional, must be a valid number.                                                                |
| **VOLATILITY INPUTS:** |                                                      |                                                                                                   |
| Model Type             | Type of volatility model to apply.                  | Select from dropdown: Just the averages, Simple volatility (min/max), Comprehensive volatility, Student's t distribution. |
| Mean / Drift           | Expected Monthly Return.                            | Optional, must be a valid number.                                                                |
| Min %                  | Minimum percentage deviation (Flat).                | Required if Model Type is "Simple volatility", must be a number, must be less than Max %.         |
| Max %                  | Maximum percentage deviation (Flat).                | Required if Model Type is "Simple volatility", must be a number, must be greater than Min %.      |
| Steps                  | Number of intervals between min and max (Flat).      | Required if Model Type is "Simple volatility", must be a number.                                 |
| Scale (Vol)            | Volatility Scale (Student-T).                       | Required if Model Type is "Student's t distribution", must be a number.                            |
| Freedom (Deg)          | Degrees of freedom (Student-T).                     | Required if Model Type is "Student's t distribution", must be a number.                            |
| Likelyhood (Alpha)     | Tail Weight (NRIG).                                 | Required if Model Type is "Comprehensive volatility", must be a number.                                 |
| Skew (Imbalance, Beta) | Imbalance (NRIG).                                  | Required if Model Type is "Comprehensive volatility", must be a number.                                 |
| Scale (Delta)          | Volatility Scale (NRIG).                            | Required if Model Type is "Comprehensive volatility", must be a number.                                 |

### Expense Form

| Label                  | Purpose                                              | Validation Rules                                                                                    |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Name                   | Name of the expense item (e.g., Salaries).          | Required, must not be empty.                                                                      |
| Category               | Category of expense (e.g., OpEx, CapEx).            | Select from dropdown: OpEx, CapEx, Payroll, Marketing.                                          |
| Initial Amount ($)     | Starting expense amount.                            | Required, must be a valid number.                                                                |
| Growth Rate (%/mo)     | Monthly growth rate percentage.                     | Optional, must be a valid number.                                                                |
| % of Revenue        | Percentage of revenue tied to expense.            | Optional, must be a valid number.                                                               |
| Frequency              | How often expense is incurred (e.g., Monthly).      | Select from dropdown: Monthly, One-time, Quarterly, Annually.                                     |
| Start Month            | Month in which expense begins.                     | Required, must be a valid number.                                                                |
| End Month (Opt)          | Month in which expense ends (optional).          | Optional, must be a valid number.                                                                |
| **VOLATILITY INPUTS:** |                                                      |                                                                                                   |
| Model Type             | Type of volatility model to apply.                  | Select from dropdown: Just the averages, Simple volatility (min/max), Comprehensive volatility, Student's t distribution. |
| Mean / Drift           | Expected Monthly Return.                            | Optional, must be a valid number.                                                                |
| Min %                  | Minimum percentage deviation (Flat).                | Required if Model Type is "Simple volatility", must be a number, must be less than Max %.         |
| Max %                  | Maximum percentage deviation (Flat).                | Required if Model Type is "Simple volatility", must be a number, must be greater than Min %.      |
| Steps                  | Number of intervals between min and max (Flat).      | Required if Model Type is "Simple volatility", must be a number.                                 |
| Scale (Vol)            | Volatility Scale (Student-T).                       | Required if Model Type is "Student's t distribution", must be a number.                            |
| Freedom (Deg)          | Degrees of freedom (Student-T).                     | Required if Model Type is "Student's t distribution", must be a number.                            |
| Likelyhood (Alpha)     | Tail Weight (NRIG).                                 | Required if Model Type is "Comprehensive volatility", must be a number.                                 |
| Skew (Imbalance, Beta) | Imbalance (NRIG).                                  | Required if Model Type is "Comprehensive volatility", must be a number.                                 |
| Scale (Delta)          | Volatility Scale (NRIG).                            | Required if Model Type is "Comprehensive volatility", must be a number.                                 |

### Capital Form

| Label        | Purpose                                  | Validation Rules                                                                                       |
| ------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Source Name  | Name of the capital source (e.g., Seed Round). | Required, must not be empty.                                                                                     |
| Amount ($)   | Amount of capital injection.             | Required, must be a valid number.                                                                  |
| Month        | Month in which capital is injected.     | Required, must be an integer between 1 and 120 (inclusive).                                        |

### Capital Growth Form

| Label                      | Purpose                                                              | Validation Rules                                                                                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model Type             | Type of volatility model to apply.                  | Select from dropdown: Just the averages, Simple volatility (min/max), Comprehensive volatility, Student's t distribution. |
| Expected Monthly Return (Mean %) | Expected monthly return percentage for investment policy.          | Required, must be a valid number.                                                                                                                                                                             |
| Min %                  | Minimum percentage deviation (Flat).                | Required if Model Type is "Simple volatility", must be a number, must be less than Max %.         |
| Max %                  | Maximum percentage deviation (Flat).                | Required if Model Type is "Simple volatility", must be a number, must be greater than Min %.      |
| Steps                  | Number of intervals between min and max (Flat).      | Required if Model Type is "Simple volatility", must be a number.                                 |
| Scale (Vol)            | Volatility Scale (Student-T).                       | Required if Model Type is "Student's t distribution", must be a number.                            |
| Freedom (Deg)          | Degrees of freedom (Student-T).                     | Required if Model Type is "Student's t distribution", must be a number.                            |
| Likelyhood (Alpha)     | Tail Weight (NRIG).                                 | Required if Model Type is "Comprehensive volatility", must be a number.                                 |
| Skew (Imbalance, Beta) | Imbalance (NRIG).                                  | Required if Model Type is "Comprehensive volatility", must be a number.                                 |
| Scale (Delta)          | Volatility Scale (NRIG).                            | Required if Model Type is "Comprehensive volatility", must be a number.                                 |

### Dividend Form

| Label                 | Purpose                                                            | Validation Rules                                                                            |
| --------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Enable Dividends      | Toggle dividends payout                                            | Boolean Value                                                                             |
| Safety Threshold ($)  | Minimum cash balance required before dividends are paid.            | Required, must be a valid number                                                          |
| Payout Percentage     | Percentage of surplus cash distributed as dividends (0-100).   | Required, must be a valid number                                                           |

### Credit Form

| Label               | Purpose                                                                       | Validation Rules                                                                     |
| ------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Max Limit ($)       | Maximum credit facility limit.                                                  | Required, must be a valid number.                                                   |
| Interest Rate (%)   | Interest rate on the credit facility.                                          | Required, must be a valid number.                                                  |
| Rate Type           | Determines whether the interest rate is Annual (APR) or Monthly  | Boolean Value                                                   |

### Valuation Form

| Label                 | Purpose                                                   | Validation Rules                                                                  |
| --------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Valuation Method      | Method used for valuation (Revenue Multiple or EBITDA Multiple).  | Select from radio: Revenue Multiple or EBITDA Multiple                            |
| Revenue Multiple (x)  | Multiple applied to revenue for valuation.              | Required if Valuation Method is Revenue Multiple, must be a valid number.       |
| EBITDA Multiple (x) | Multiple applied to EBITDA for valuation.             | Required if Valuation Method is EBITDA Multiple, must be a valid number.      |

### Auth Form

| Label                 | Purpose                                                            | Validation Rules                                                                            |
| --------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Username      | Required Username                                            | Required                                                                             |
| Email  | Required Email                                           | Required                                                          |
| Full Name   | Required Full Name                                           | Required                                                          |
| Company / Organization Name   | Required Name  | Required                                                         |
| Password   | Required Password  | Required                                                         |
| Confirm Password   | Required  | Required                                                         |
|I am a student / individual   | Toggle for individual  | Boolean Value                                                          |

## 2. Simulation Parameters

The simulation allows you to model financial performance under different conditions. Volatility can be included for Revenue, Expenses and Capital Growth. The different types of volatility are described below:

*   **Deterministic:** The simulation runs without any volatility. This is the most basic form of modelling that gives you an idea of what to expect without accounting for any unexpected conditions

*   **NRIG (Normal-Inverse-Gamma):** This model uses the Normal-Inverse-Gamma distribution to generate revenue outcomes. The distribution has four parameters that control different aspects of the stochastic simulation:
    *   Alpha: Affects the Likelihood of extreme events in the simulation. Higher values lead to more predictable outcomes with very few extreme values. Lower values increase the probability of extreme events in the simulation.

    *   Beta: Imbalance affects skewness. This affects the relationship between up and downside risks, allowing users to skew the balance towards either the upside or downside depending on business conditions.

    *   Delta: Delta provides a way to scale outcomes in the model. Higher values lead to higher volatility while low values represent stability.

*   **Student-T:** This model uses the Student-T distribution to generate revenue outcomes. The Student-T distribution has two parameters that control different aspects of the stochastic simulation.

    *   Scale: This affects how far away the data points are from the mean in the distribution. Higher values lead to higher volatility while low values represent stability.

    *   Freedom: This affects the probability of extreme values or tail risk. Higher values lead to more predictable outcomes with very few extreme values. Lower values increase the probability of extreme events in the simulation.

*   **Flat:** This is the simplest form of volatility and the default for revenue. Users define a minimum and maximum percentage deviation from expected revenue or expense values. During the stochastic simulation, monthly revenue is uniformly distributed between these two values.

    *   Vol Min: The minimum range for a given month that revenue could deviate

    *   Vol Max: The maximum range for a given month that revenue could deviate

    *   Vol Intervals: The number of data points for revenue

## 3. UI Logic

### "Student/Individual" Bypass (Auth Form)

The "I am a student / individual" checkbox on the registration form has a direct impact on the `Company / Organization Name` field:

*   **Checked:**
    *   The `Company / Organization Name` field is disabled.
    *   The value of the `Company / Organization Name` field is automatically set to "Individual".
*   **Unchecked:**
    *   The `Company / Organization Name` field is enabled.
    *   The user is required to enter a company or organization name.

This logic is implemented via the `handleStudentChange` function.  This simplifies the registration process for individual users and students by pre-filling the company name and disabling the field, reducing the amount of input required.


# NRIG Mappings

Here are the current mappings for the **NRIG** distribution, translating the "Words" (Frontend Menu Labels) into the "Numbers" (Backend Math Parameters).

### 1. Fatness (Tail Risk)

Controls **Alpha (α)**. Lower values mean "fatter tails" (more extreme events).

|Menu Label (User Sees)|Backend Key (Frontend Sends)|Alpha (α) Value|Description|
|---|---|---|---|
|**Ultra flat tails**|`skinny`|**100.0**|Extreme events are vanishingly rare.|
|**Normal Distribution**|`normal`|**50.0**|Standard Bell Curve. 3-sigma events < 0.3%.|
|**Moderate Tails**|`moderate`|**2.0**|Realistic market surprises (S&P 500 style).|
|**Heavy Tails**|`heavy`|**0.5**|**Black Swans.** Extreme events are common.|

---

### 2. Skew (Directional Bias)

Controls **Beta (β)** via a **Factor**.

β=α×Factor

|Menu Label (User Sees)|Backend Key (Frontend Sends)|Beta Factor|Effect|
|---|---|---|---|
|**Downside bias is very strong**|`strong_downside`|**-0.9**|Crashes are very likely.|
|**Downside bias is medium**|`medium_downside`|**-0.4**|Slight negative skew.|
|**Symmetric (Even Chance)**|`symmetric`|**0.0**|Upside and Downside risks are equal.|
|**Upside bias is medium**|`medium_upside`|**0.4**|Slight positive skew.|
|**Upside bias is very strong**|`strong_upside`|**0.9**|"Moonshots" are likely.|

---

### 3. Width (Volatility)

Controls **Delta (δ)** via **Target Sigma (σ)**. The backend calculates δ dynamically to ensure the **Total Volatility** matches the target, regardless of how skewed or fat-tailed the distribution is.

δ≈σ2×α×(1−Factor2)1.5

|Menu Label (User Sees)|Backend Key (Frontend Sends)|Target Sigma (σ)|Resulting Delta (δ)*|
|---|---|---|---|
|**Very Low Volatility**|`very_low`|**1.0%**|≈0.5|
|**Low Volatility**|`low`|**3.2%**|≈5.0|
|**Medium Volatility**|`medium`|**10.0%**|≈50.0|
|**High Volatility**|`high`|**32.0%**|≈512.0|

_*Note: The "Resulting Delta" column assumes **Heavy Tails** (α=0.5) and **Symmetric** (β=0). If you add Skew, the Delta will automatically decrease to keep the total volatility constant at the Target Sigma._


# Numbers in the Graphs
Based on the simulation logic we have been discussing, here is exactly how these three core metrics are calculated at every time step (month) for every company in the fund.

### 1. Cash on Hand (The "Checking Account")

This represents the liquid liquidity currently held by the company. It fluctuates up and down every month.

**The Formula:**

$$\text{Cash}_{t} = \text{Cash}_{t-1} + \text{Revenue}_t - \text{Expenses}_t - \text{Dividend Paid}_t$$

- **Starts at:** The initial funding amount (e.g., $100,000).
    
- **Increases by:** The random variable generated by your Revenue Sampler.
    
- **Decreases by:** The random variable generated by your Expense Sampler.
    
- **Decreases by:** Any dividend calculated and paid out in that month.
    

### 2. Cum Dividends (The "Shareholder's Pocket")

This is a running counter (accumulator) of all cash that has been extracted from the company and transferred to the investors/fund. It **never decreases**.

**The Formula:**

$$\text{CumDiv}_{t} = \text{CumDiv}_{t-1} + \text{Dividend Paid}_t$$

- **Starts at:** 0.
    
- **Increases by:** The dividend amount whenever a payout occurs.
    

### 3. Net Value (Total Wealth Generated)

This is the "Scorecard" metric. It tells you the total economic value of the path. It answers: _"If we liquidated the company today, how much cash would we have, plus how much have we already taken out?"_

**The Formula:**

$$\text{Net Value} = \text{Cash on Hand}_t + \text{Cum Dividends}_t$$

- **Why this matters:** This is the metric that allows you to compare a "Growth Company" (High Cash, Low Dividends) fairly against a "Cash Cow" (Low Cash, High Dividends).

# Fix the fund simulation re pooling.

These are excellent refinements. You are effectively shifting the simulation from a **Limited Liability (Venture Capital)** model to a **Full Recourse (Venture Debt / Solvency)** model.

Your intuition on the "Sudden 100k Benefit" is precisely correct. In statistical mechanics terms, the "absorbing barrier" at 0 (insolvency) was destroying information (the magnitude of the failure). By removing that barrier and keeping the negative values, you preserve the **full distribution of outcomes**, which is the only way to honestly measure Volatility Drag.

### 1. Reflection on "Positive Delta" Pooling

The logic `max(0, current) - max(0, previous)` is the perfect "High Water Mark" implementation for this context.

- **Scenario A (Deep Hole):** Cash moves from -100k $\to$ -50k.
    
    - Pool Base: $0 - 0 = 0$. (No tax. Company uses 100% of profit to heal).
        
- **Scenario B (Breach):** Cash moves from -20k $\to$ +10k.
    
    - Pool Base: $10k - 0 = 10k$. (Tax applies only to the surplus).
        
- **Scenario C (Growth):** Cash moves from +10k $\to$ +50k.
    
    - Pool Base: $50k - 10k = 40k$. (Standard tax on growth).
        

This ensures the pool acts as a "Success Tax" rather than a "Recovery Tax."

### 2. Reflection on "Persistent Debt"

Treating the negative cash balance as "Venture Debt" on the Fund's books solves the "Masking" problem.

- **Previously:** A company failing at -$1M vanished (Cost to Fund = Initial Investment).
    
- **Now:** A company failing at -$1M stays at -$1M (Cost to Fund = Initial Investment + $1M Debt).
    
- **Result:** The "Non-Pooled" portfolio will look **much worse** (lower mean, fatter left tail). The "Pooled" portfolio will likely outperform it more significantly because pooling prevents companies from reaching that -$1M depth in the first place.

The `MonthlyData` JSON structure is identical for both a Single Company and the entire Fund. The backend uses the exact same data contract for both levels, but the numbers inside represent different things depending on which chart you are looking at.

### 1. At the Single Company Level

When you look at a single company's line (e.g., in the "Single Run" or "Deterministic" view for one company):

- **`cumulative_external_capital`**: The actual cash injected into **this specific company**.
    
- **`cash_balance`**: This company's bank balance (positive) or debt (negative).
    
- **`total_exposure`**: The capital injected into this company **plus** the absolute value of **this company's specific debt**.
    

### 2. At the Fund Level (Aggregated)

When you look at the Fund Simulation (e.g., the "Fund NAV" chart):

- **`cumulative_external_capital`**: The sum of **all** injections into **all** companies (Total LP Capital Deployed).
    
- **`cash_balance`**: The sum of **all** companies' cash balances (Winners' Cash - Losers' Debt).
    
- **`total_exposure`**: The sum of **all** companies' exposures (Total LP Capital + Total Venture Debt across the portfolio).
### Summary of the Data Contract

| **Your Concept**    | **JSON Field**                | **Calculation Logic**                            |
| ------------------- | ----------------------------- | ------------------------------------------------ |
| **Equity Invested** | `cumulative_external_capital` | Sum of injections.                               |
| **Current Cash**    | `cash_balance`                | Bank Balance (Positive) or Overdraft (Negative). |
| **Debt Load**       | _Derived from above_          | `abs(min(0, cash_balance))`                      |
| **Total Exposure**  | `total_exposure`              | `cumulative_external_capital` + `                |


# Upper absorbing boundary.
This is a **crucially important** addition.

Your intuition is perfectly aligned with **Econophysics** and **Agent-Based Modeling** best practices. In purely mathematical simulations (Geometric Brownian Motion), there is no friction. In the real world, friction increases with scale:

1. **Diminishing Returns:** Doubling a $100B company is harder than doubling a $1M company.
    
2. **Resource Constraints:** The market for your product isn't infinite (GDP cap).
    
3. **Regulatory/Social Friction:** Antitrust, strikes, higher taxes, organizational entropy.
    

Without this **"Soft Absorbing Barrier"** on the right tail (Success), your Mean (Average) will always diverge from your Median (Typical Experience) because one "Galactic Empire" company will skew the entire fund's value to infinity. This tax restores **stationarity** to the system.

### The Implementation Plan

I will add a **"Success Tax"** logic to the end of the monthly step.

1. **Inputs:**
    
    - `soft_limit_active` (Bool): Is the tax on?
        
    - `soft_limit_threshold` (Float): The cash pile size where trouble starts (e.g., $100M).
        
    - `soft_limit_tax_rate` (Float): The % of _excess_ cash seized per month (e.g., 5% of everything above $100M).
        
2. **The Logic:**
    
    - Calculated **after** Revenue, Expenses, and Pooling.
        
    - `Excess = Max(0, Cash - Threshold)`
        
    - `Tax = Excess * TaxRate`
        
    - `Cash = Cash - Tax`
        
    - The money is **destroyed** (removed from the Universe), not redistributed.

# Resolving the P50 Discrepancy & New Data Contract

You are entirely correct in your diagnosis: mixing cross-sectional arrays with pathwise objects creates mismatches if the sorting metric isn't strictly unified.

To fix this, the Rust backend has just been updated to a **Context-Aware Sorting Architecture**. The backend now knows whether it is simulating a Single Company or a Full Fund, and it changes its mathematical sorting rules accordingly so your charts and cards will always match perfectly.

Here is the exact math the backend is now executing, and what you need to display:

**1. When viewing a SINGLE COMPANY (Ensemble Mode)**

- **The Math:** A company’s survival relies purely on liquidity. Therefore, the backend sorts all 999 paths strictly by `cash_balance` for both the cross-sectional graph AND the final pathwise `p50_data` selection.
    
- **The Chart (`pX_value`):** These arrays now contain cross-sectional **Cash Balances**.
    
- **The P50 Card:** You should display `p50_data[last].cash_balance`.
    
- **The Result:** The final point on the P50 chart pop-up will mathematically equal the P50 Cash Card exactly.
    

**2. When viewing a FUND (Portfolio Mode)**

- **The Math:** A Fund’s success is judged by its Net Asset Value (which includes cash + dividends extracted from the companies). Therefore, the backend sorts all 999 universes strictly by `total_value` for both the graph and the `p50_data` path.
    
- **The Chart (`pX_value`):** These arrays now contain cross-sectional **Total Values** (NAV).
    
- **The P50 Card:** _Action Required for UI:_ You must display `p50_data[last].total_value` on the card for Funds (not cash balance!).
    
- **The Result:** The final point on the P50 chart pop-up will exactly match the P50 Total Value Card.
    

**Summary for the UI:** Because the backend now dynamically changes the data inside `p50_value` based on the context, **your KPI cards must dynamically change which field they read from `p50_data`** to match the graph:

- Single Company View = Read `cash_balance`.
    
- Fund View = Read `total_value`.