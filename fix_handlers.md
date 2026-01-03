🤖 Connecting to gemini-3-pro-preview (Paid Tier)...
Here are the updated files `backend/src/handlers/plans.rs` and `backend/src/handlers/staffing.rs`.

I have updated the SQL queries to:
1.  Use explicit column selection instead of `SELECT *` to ensure mapping to the `StaffingRole` struct works correctly.
2.  Renamed `count` to `target_count` in all queries (SELECT, INSERT, UPDATE).
3.  Added the new fields `hiring_plan` and `hiring_rate` to the SELECT, INSERT, and UPDATE statements.
4.  Updated the request structs in `staffing.rs` to accept the new fields.

### 1. `backend/src/handlers/plans.rs`

```rust
use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    Json,
};
use serde::{Deserialize};
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use crate::models::FinancialPlan;
use crate::errors::AppError;
use crate::projection::{generate_simulation, SimulationResult};
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;

#[derive(Deserialize)]
pub struct CreatePlanRequest {
    pub company_id: Uuid,
    pub name: String,
    pub start_month: String, // YYYY-MM-01
}

pub async fn create_plan(
    State(pool): State<Pool<Postgres>>,
    Json(payload): Json<CreatePlanRequest>,
) -> Result<Json<FinancialPlan>, AppError> {
    let plan = sqlx::query_as!(
        FinancialPlan,
        "INSERT INTO financial_plans (company_id, name, start_month) VALUES ($1, $2, $3) RETURNING *",
        payload.company_id,
        payload.name,
        chrono::NaiveDate::parse_from_str(&payload.start_month, "%Y-%m-%d").unwrap()
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(plan))
}

pub async fn get_all_plans(
    State(pool): State<Pool<Postgres>>,
) -> Result<Json<Vec<FinancialPlan>>, AppError> {
    let plans = sqlx::query_as!(
        FinancialPlan,
        "SELECT * FROM financial_plans ORDER BY created_at DESC"
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(plans))
}

pub async fn get_plan(
    State(pool): State<Pool<Postgres>>,
    Path(id): Path<Uuid>,
) -> Result<Json<FinancialPlan>, AppError> {
    let plan = sqlx::query_as!(
        FinancialPlan,
        "SELECT * FROM financial_plans WHERE id = $1",
        id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or(AppError::NotFound("Plan not found".to_string()))?;

    Ok(Json(plan))
}

pub async fn delete_plan(
    State(pool): State<Pool<Postgres>>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query!("DELETE FROM financial_plans WHERE id = $1", id)
        .execute(&pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Plan not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// --- PROJECTION LOGIC ---

#[derive(Deserialize)]
pub struct GetProjectionQuery {
    pub months: Option<i32>,
    pub initial_cash: Option<Decimal>,
    pub mode: Option<String>,
    pub stop_insolvency: Option<bool>, // New Param
}

pub async fn get_plan_projection(
    State(pool): State<Pool<Postgres>>,
    Path(id): Path<Uuid>,
    Query(params): Query<GetProjectionQuery>,
) -> Result<Json<SimulationResult>, AppError> {
    
    // Fetch Plan Info
    let plan = sqlx::query_as!(
        FinancialPlan,
        "SELECT * FROM financial_plans WHERE id = $1",
        id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or(AppError::NotFound("Plan not found".to_string()))?;

    // Fetch Inputs
    let revenue_items = sqlx::query_as!(
        crate::models::RevenueItem,
        "SELECT * FROM revenue_items WHERE plan_id = $1 ORDER BY start_month ASC",
        id
    )
    .fetch_all(&pool)
    .await?;

    let expense_items = sqlx::query_as!(
        crate::models::ExpenseItem,
        "SELECT * FROM expense_items WHERE plan_id = $1 ORDER BY start_month ASC",
        id
    )
    .fetch_all(&pool)
    .await?;

    let event_shocks = sqlx::query_as!(
        crate::models::EventShock,
        "SELECT * FROM event_shocks WHERE plan_id = $1",
        id
    )
    .fetch_all(&pool)
    .await?;

    let capital_injections = sqlx::query_as!(
        crate::models::CapitalInjection,
        "SELECT * FROM capital_injections WHERE plan_id = $1 ORDER BY month ASC",
        id
    )
    .fetch_all(&pool)
    .await?;

    let dividend_policy = sqlx::query_as!(
        crate::models::DividendPolicy,
        "SELECT * FROM dividend_policies WHERE plan_id = $1",
        id
    )
    .fetch_optional(&pool)
    .await.ok().flatten();

    let credit_facility = sqlx::query_as!(
        crate::models::CreditFacility,
        "SELECT * FROM credit_facilities WHERE plan_id = $1",
        id
    )
    .fetch_optional(&pool)
    .await.ok().flatten();

    let valuation_assumptions = sqlx::query_as!(
        crate::models::ValuationAssumption,
        "SELECT * FROM valuation_assumptions WHERE plan_id = $1 ORDER BY date_applied DESC LIMIT 1",
        id
    )
    .fetch_all(&pool)
    .await?;

    // Updated to select specific columns matching StaffingRole struct
    let staffing_roles = sqlx::query_as!(
        crate::models::StaffingRole,
        "SELECT id, plan_id, role_name, annual_salary, start_month, target_count, hiring_plan, hiring_rate, annual_increase, created_at 
         FROM staffing_roles WHERE plan_id = $1 ORDER BY start_month ASC",
        id
    )
    .fetch_all(&pool)
    .await?;

// ... previous fetches ...
    let capital_growth = sqlx::query_as!(
        crate::models::CapitalGrowthPolicy,
        "SELECT * FROM capital_growth_policies WHERE plan_id = $1",
        id
    )
    .fetch_optional(&pool)
    .await.ok().flatten();
    
    // Run Simulation
    let months = params.months.unwrap_or(60);
    let initial_cash = params.initial_cash.unwrap_or(Decimal::from_f64(0.0).unwrap());
    let use_monte_carlo = params.mode.unwrap_or("single".to_string()) == "monte_carlo";
    let stop_insolvency = params.stop_insolvency.unwrap_or(false);

    let result = generate_simulation(
        plan.start_month,
        months,
        initial_cash,
        &revenue_items,
        &expense_items,
        &event_shocks,
        &capital_injections,
        &dividend_policy,
        &credit_facility,
        &capital_growth, 
        &staffing_roles,
        &valuation_assumptions,
        use_monte_carlo,
        stop_insolvency // Pass it down
    );

    Ok(Json(result))
}
```

### 2. `backend/src/handlers/staffing.rs`

```rust
use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;
use sqlx::{Pool, Postgres};
use rust_decimal::Decimal;
use crate::models::StaffingRole;
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct CreateStaffingRoleRequest {
    pub plan_id: Uuid,
    pub role_name: String,
    pub annual_salary: Decimal,
    pub start_month: i32,
    pub target_count: i32, // Renamed from count
    pub hiring_plan: String, // New field
    pub hiring_rate: Option<i32>, // New field
    pub annual_increase: Decimal,
}

#[derive(Deserialize)]
pub struct UpdateStaffingRoleRequest {
    pub role_name: Option<String>,
    pub annual_salary: Option<Decimal>,
    pub start_month: Option<i32>,
    pub target_count: Option<i32>, // Renamed from count
    pub hiring_plan: Option<String>, // New field
    pub hiring_rate: Option<i32>, // New field
    pub annual_increase: Option<Decimal>,
}

pub async fn get_staffing_roles(
    State(pool): State<Pool<Postgres>>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<Vec<StaffingRole>>, AppError> {
    let roles = sqlx::query_as!(
        StaffingRole,
        "SELECT id, plan_id, role_name, annual_salary, start_month, target_count, hiring_plan, hiring_rate, annual_increase, created_at 
         FROM staffing_roles 
         WHERE plan_id = $1 
         ORDER BY start_month ASC",
        plan_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(roles))
}

pub async fn create_staffing_role(
    State(pool): State<Pool<Postgres>>,
    Json(payload): Json<CreateStaffingRoleRequest>,
) -> Result<Json<StaffingRole>, AppError> {
    // Removed created_at from INSERT columns and VALUES.
    // The database will handle the default timestamp.
    let role = sqlx::query_as!(
        StaffingRole,
        "INSERT INTO staffing_roles (plan_id, role_name, annual_salary, start_month, target_count, hiring_plan, hiring_rate, annual_increase) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id, plan_id, role_name, annual_salary, start_month, target_count, hiring_plan, hiring_rate, annual_increase, created_at",
        payload.plan_id,
        payload.role_name,
        payload.annual_salary,
        payload.start_month,
        payload.target_count,
        payload.hiring_plan,
        payload.hiring_rate,
        payload.annual_increase
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(role))
}

pub async fn update_staffing_role(
    State(pool): State<Pool<Postgres>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateStaffingRoleRequest>,
) -> Result<Json<StaffingRole>, AppError> {
    // Added created_at to the RETURNING clause so the StaffingRole struct can be fully populated.
    let role = sqlx::query_as!(
        StaffingRole,
        "UPDATE staffing_roles SET
            role_name = COALESCE($1, role_name),
            annual_salary = COALESCE($2, annual_salary),
            start_month = COALESCE($3, start_month),
            target_count = COALESCE($4, target_count),
            hiring_plan = COALESCE($5, hiring_plan),
            hiring_rate = COALESCE($6, hiring_rate),
            annual_increase = COALESCE($7, annual_increase)
         WHERE id = $8
         RETURNING id, plan_id, role_name, annual_salary, start_month, target_count, hiring_plan, hiring_rate, annual_increase, created_at",
        payload.role_name,
        payload.annual_salary,
        payload.start_month,
        payload.target_count,
        payload.hiring_plan,
        payload.hiring_rate,
        payload.annual_increase,
        id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(role))
}

pub async fn delete_staffing_role(
    State(pool): State<Pool<Postgres>>,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    sqlx::query!("DELETE FROM staffing_roles WHERE id = $1", id)
        .execute(&pool)
        .await?;
    Ok(())
}
```

