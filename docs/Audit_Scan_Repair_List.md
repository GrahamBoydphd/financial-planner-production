
**Master Fortress Standard**. The scan found **193 instances of `f64`**, **24 instances of unscoped `name` keys**, and **70 potential non-string percentage assignments**.

Below is the summary of repairs required, categorized by the responsible architectural domain.

---

### 🛠️ Backend & Database Repair List (Rust)

**Focus**: Eliminating floating-point drift, enforcing scoped naming, and hardening SQL queries.

- **Projection Engine (`backend/src/projection.rs`)**: This file is the highest priority. It contains numerous `f64` types that must be converted to `rust_decimal::Decimal` to prevent compounding drift in Monte Carlo simulations.
    
- **API Handlers (`backend/src/handlers/`)**: Multiple files (notably `expense_handlers.rs`, `revenue_handlers.rs`, and `staffing_handlers.rs`) are using `f64` for financial inputs. These must be refactored to use `String` in the DTOs and `Decimal` for internal logic.
    
- **Database Models (`backend/src/models/`)**: Several structs still use the unscoped `name` field. These must be renamed to `role_name`, `expense_name`, etc., to match the scoped naming standard.
    
- **SQL Macros**: Any instances of `SELECT *` identified in the scan (specifically within `sqlx::query_as!`) must be replaced with explicit column lists using the `!` non-null override.
    

### 🎨 Frontend Repair List (TypeScript/JSON)

**Focus**: Ensuring data transmission compliance and normalization.

- **API Data Transfer (DTOs)**: The scan flagged 70 instances where percentage fields (e.g., `growth_rate_percent`) may be assigned as raw numbers. These must be wrapped in **Strings** (e.g., `"3.0"`) before being dispatched to the API.
    
- **Component State**: Verify that all "Edit" forms on the frontend lowercase their payload values (normalization) for categories like `fixed_count` or `monthly_rate` before sending them to the backend.
    
- **Naming Consistency**: Update frontend interfaces to reflect the scoped naming change (e.g., changing `item.name` to `item.expense_name`) to stay in sync with the new backend schema.
    
  

