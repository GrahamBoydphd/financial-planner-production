use axum::{
    extract::{Path, State, Query, Extension},
    http::StatusCode,
    Json,
};
use serde::{Deserialize};
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use crate::models::{FinancialPlan, Claims};
use crate::errors::AppError;
use crate::projection::{generate_simulation, SimulationResult};
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;
use chrono::NaiveDate;
use std::str::FromStr;

#[derive(Deserialize)]
pub struct CreatePlanRequest {
    pub company_id: Uuid,
    pub name: String,
    pub start_month: String, // YYYY-MM-01
}

#[derive(Deserialize)]
pub struct UpdatePlanRequest {
    pub name: Option<String>,
    pub start_month: Option<String>,
    pub pooling_fraction: Option<Decimal>,
    pub initial_cash: Option<String>,
}

pub async fn create_plan(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreatePlanRequest>,
) -> Result<Json<FinancialPlan>, AppError> {
    let plan = sqlx::query_as!(
        FinancialPlan,
        "INSERT INTO financial_plans (company_id, name, start_month, tenant_id) VALUES ($1, $2, $3, $4) RETURNING *",
        payload.company_id,
        payload.name,
        chrono::NaiveDate::parse_from_str(&payload.start_month, "%Y-%m-%d").unwrap(),
        claims.tenant_id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(plan))
}

pub async fn update_plan(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdatePlanRequest>,
) -> Result<Json<FinancialPlan>, AppError> {
    let start_date = payload.start_month
        .as_deref()
        .map(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
        .flatten();

    let initial_cash = payload.initial_cash
        .as_deref()
        .map(|s| Decimal::from_str(s).ok())
        .flatten();

    let plan: Option<FinancialPlan> = sqlx::query_as!(
        FinancialPlan,
        "UPDATE financial_plans 
         SET name = COALESCE($1, name), 
             start_month = COALESCE($2, start_month), 
             pooling_fraction = COALESCE($3, pooling_fraction),
             initial_cash = COALESCE($4, initial_cash),
             updated_at = NOW() 
         WHERE id = $5 AND tenant_id = $6
         RETURNING *",
        payload.name,
        start_date,
        payload.pooling_fraction,
        initial_cash,
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    let plan = plan.ok_or(AppError::NotFound("Plan not found".to_string()))?;

    Ok(Json(plan))
}

pub async fn get_all_plans(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<FinancialPlan>>, AppError> {
    let plans = sqlx::query_as!(
        FinancialPlan,
        "SELECT * FROM financial_plans WHERE tenant_id = $1 ORDER BY created_at DESC",
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(plans))
}

pub async fn get_plan(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<FinancialPlan>, AppError> {
    let plan: Option<FinancialPlan> = sqlx::query_as!(
        FinancialPlan,
        "SELECT * FROM financial_plans WHERE id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    let plan = plan.ok_or(AppError::NotFound("Plan not found".to_string()))?;

    Ok(Json(plan))
}

pub async fn delete_plan(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result: sqlx::postgres::PgQueryResult = sqlx::query!("DELETE FROM financial_plans WHERE id = $1 AND tenant_id = $2", id, claims.tenant_id)
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
    pub stop_insolvency: Option<bool>,
}

pub async fn get_plan_projection(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Query(params): Query<GetProjectionQuery>,
) -> Result<Json<SimulationResult>, AppError> {
    
    // DoS Protection: Check months limit
    let months = params.months.unwrap_or(60);
    if months > 1200 {
        return Err(AppError::ValidationError("Simulation limited to 100 years (1200 months)".into()));
    }

    // Fetch Plan Info
    let plan: Option<FinancialPlan> = sqlx::query_as!(
        FinancialPlan,
        "SELECT * FROM financial_plans WHERE id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    let plan = plan.ok_or(AppError::NotFound("Plan not found".to_string()))?;

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

    let dividend_policy: Option<crate::models::DividendPolicy> = sqlx::query_as!(
        crate::models::DividendPolicy,
        "SELECT * FROM dividend_policies WHERE plan_id = $1",
        id
    )
    .fetch_optional(&pool)
    .await.ok().flatten();

    let credit_facility: Option<crate::models::CreditFacility> = sqlx::query_as!(
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

    let staffing_roles = sqlx::query_as!(
        crate::models::StaffingRole,
        "SELECT id, plan_id, role_name, annual_salary, start_month, target_count, hiring_plan, hiring_rate, annual_increase, created_at 
         FROM staffing_roles WHERE plan_id = $1 ORDER BY start_month ASC",
        id
    )
    .fetch_all(&pool)
    .await?;

    let capital_growth: Option<crate::models::CapitalGrowthPolicy> = sqlx::query_as!(
        crate::models::CapitalGrowthPolicy,
        "SELECT * FROM capital_growth_policies WHERE plan_id = $1",
        id
    )
    .fetch_optional(&pool)
    .await.ok().flatten();
    
    // Run Simulation
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
        stop_insolvency,
        plan.pooling_fraction // Pass pooling fraction
    );

    Ok(Json(result))
}
