# 🛡️ Evolutesix Financial Engine API Standards (V3 Hardened)

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