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
