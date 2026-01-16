🤖 Connecting to gemini-3-pro-preview (Paid Tier)...
<file path='backend/src/models.rs'>
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{NaiveDate, DateTime, Utc};
use rust_decimal::Decimal;

// --- Phase 0: Multi-Tenancy & Auth ---

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Tenant {
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: Option<String>,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub full_name: String,
    pub tenant_id: Uuid,
    pub created_at: DateTime<Utc>,
}

// --- Phase 3: Portfolio Structure ---

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Fund {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub tenant_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Company {
    pub id: Uuid,
    pub fund_id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub industry: Option<String>,
    pub business_model: Option<String>,
    pub technology: Option<String>,
    pub tenant_id: Uuid,
}

// --- Phase 1 & 2: Financial Models ---

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct FinancialPlan {
    pub id: Uuid,
    pub company_id: Uuid,
    pub name: String,
    pub start_month: NaiveDate,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
    pub initial_cash: Decimal,
    pub pooling_fraction: Decimal, // Added for Non-Ergodicity Module
    pub tenant_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct RevenueItem {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub name: String,
    pub source: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: Decimal,
    pub growth_rate_percent: Decimal,
    pub frequency: String,
    pub cost_of_revenue_percent: Option<Decimal>,
    pub volatility_type: Option<String>,
    pub vol_min: Option<Decimal>,
    pub vol_max: Option<Decimal>,
    pub vol_intervals: Option<i32>,
    pub vol_mean: Option<Decimal>,
    pub vol_scale: Option<Decimal>,
    pub vol_freedom: Option<Decimal>,
    pub vol_alpha: Option<Decimal>,
    pub vol_beta: Option<Decimal>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ExpenseItem {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub name: String,
    pub category: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: Decimal,
    pub growth_rate_percent: Decimal,
    pub frequency: String,
    pub pct_of_revenue: Option<Decimal>,
    pub volatility_type: Option<String>,
    pub vol_min: Option<Decimal>,
    pub vol_max: Option<Decimal>,
    pub vol_intervals: Option<i32>,
    pub vol_mean: Option<Decimal>,
    pub vol_scale: Option<Decimal>,
    pub vol_freedom: Option<Decimal>,
    pub vol_alpha: Option<Decimal>,
    pub vol_beta: Option<Decimal>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct CapitalInjection {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub name: String,
    pub amount: Decimal,
    pub month: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct DividendPolicy {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub is_enabled: bool,
    pub safety_threshold: Decimal,
    pub payout_ratio: Decimal,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct CreditFacility {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub facility_limit: Decimal,
    pub interest_rate: Decimal,
    pub is_annual_rate: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ValuationAssumption {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub valuation_name: String,
    pub method: String,
    pub multiplier: Decimal,
    pub date_applied: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct EventShock {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub event_name: String,
    pub shock_month: i32,
    pub impact_type: String,
    pub impact_value: Decimal,
    pub duration_months: Option<i32>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct CapitalGrowthPolicy {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub volatility_type: Option<String>,
    pub vol_min: Option<Decimal>,
    pub vol_max: Option<Decimal>,
    pub vol_intervals: Option<i32>,
    pub vol_mean: Option<Decimal>,
    pub vol_scale: Option<Decimal>,
    pub vol_freedom: Option<Decimal>,
    pub vol_alpha: Option<Decimal>,
    pub vol_beta: Option<Decimal>,
    pub created_at: DateTime<Utc>,
    pub growth_rate_percent: Decimal,
}

#[derive(Deserialize, Debug)]
pub struct CreateFundRequest {
    pub name: String,
}

#[derive(Deserialize, Debug)]
pub struct CreateCompanyRequest {
    pub fund_id: uuid::Uuid,
    pub name: String,
    pub business_model: Option<String>,
    pub industry: Option<String>,
    pub technology: Option<String>,
}

// --- Point 9: Staffing & Payroll ---
#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct StaffingRole {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub role_name: String,
    pub annual_salary: Decimal,
    pub start_month: i32,
    
    // Renamed from 'count' to 'target_count' to match sophisticated logic
    // Assumes DB column is 'target_count'
    pub target_count: i32, 
    
    // New Fields for Sophisticated Logic
    pub hiring_plan: String, // "fixed_count" or "monthly_rate"
    pub hiring_rate: Option<i32>, // e.g., 1 = hire every month, 2 = hire every 2 months
    
    pub annual_increase_percent: Decimal,
    pub created_at: DateTime<Utc>,
}

// --- Auth DTOs ---

#[derive(Deserialize, Debug)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
    pub full_name: String,
    pub email: String,
}

#[derive(Deserialize, Debug)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize, Debug)]
pub struct AuthResponse {
    pub token: String,
    pub user_id: Uuid,
    pub tenant_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub tenant_id: uuid::Uuid,
    pub exp: usize,
}
</file>

<file path='backend/src/handlers/plans.rs'>
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
use rust_decimal_macros::dec;
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
        "INSERT INTO financial_plans (company_id, name, start_month, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id, company_id, tenant_id, name, start_month, initial_cash, pooling_fraction, created_at, updated_at",
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
         RETURNING id, company_id, tenant_id, name, start_month, initial_cash, pooling_fraction, created_at, updated_at",
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
        "SELECT id, company_id, tenant_id, name, start_month, initial_cash, pooling_fraction, created_at, updated_at FROM financial_plans WHERE tenant_id = $1 ORDER BY created_at DESC",
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
        "SELECT id, company_id, tenant_id, name, start_month, initial_cash, pooling_fraction, created_at, updated_at FROM financial_plans WHERE id = $1 AND tenant_id = $2",
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
        "SELECT id, company_id, tenant_id, name, start_month, initial_cash, pooling_fraction, created_at, updated_at FROM financial_plans WHERE id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    let plan = plan.ok_or(AppError::NotFound("Plan not found".to_string()))?;

    // Fetch Inputs
    let revenue_items = sqlx::query_as!(
        crate::models::RevenueItem,
        "SELECT id, plan_id, name, source, start_month, end_month, initial_amount, growth_rate_percent, frequency, cost_of_revenue_percent, volatility_type, vol_min, vol_max, vol_intervals, vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta, created_at FROM revenue_items WHERE plan_id = $1 ORDER BY start_month ASC",
        id
    )
    .fetch_all(&pool)
    .await?;

    let expense_items = sqlx::query_as!(
        crate::models::ExpenseItem,
        "SELECT id, plan_id, name, category, start_month, end_month, initial_amount, growth_rate_percent, frequency, pct_of_revenue, volatility_type, vol_min, vol_max, vol_intervals, vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta, created_at FROM expense_items WHERE plan_id = $1 ORDER BY start_month ASC",
        id
    )
    .fetch_all(&pool)
    .await?;

    let event_shocks = sqlx::query_as!(
        crate::models::EventShock,
        "SELECT id, plan_id, event_name, shock_month, impact_type, impact_value, duration_months, created_at FROM event_shocks WHERE plan_id = $1",
        id
    )
    .fetch_all(&pool)
    .await?;

    let capital_injections = sqlx::query_as!(
        crate::models::CapitalInjection,
        "SELECT id, plan_id, name, amount, month, created_at FROM capital_injections WHERE plan_id = $1 ORDER BY month ASC",
        id
    )
    .fetch_all(&pool)
    .await?;

    let dividend_policy: Option<crate::models::DividendPolicy> = sqlx::query_as!(
        crate::models::DividendPolicy,
        "SELECT id, plan_id, is_enabled, safety_threshold, payout_ratio, created_at FROM dividend_policies WHERE plan_id = $1",
        id
    )
    .fetch_optional(&pool)
    .await.ok().flatten();

    let credit_facility: Option<crate::models::CreditFacility> = sqlx::query_as!(
        crate::models::CreditFacility,
        "SELECT id, plan_id, facility_limit, interest_rate, is_annual_rate, created_at FROM credit_facilities WHERE plan_id = $1",
        id
    )
    .fetch_optional(&pool)
    .await.ok().flatten();

    let valuation_assumptions = sqlx::query_as!(
        crate::models::ValuationAssumption,
        "SELECT id, plan_id, valuation_name, method, multiplier, date_applied, created_at FROM valuation_assumptions WHERE plan_id = $1 ORDER BY date_applied DESC LIMIT 1",
        id
    )
    .fetch_all(&pool)
    .await?;

    let staffing_roles = sqlx::query_as!(
        crate::models::StaffingRole,
        "SELECT id, plan_id, role_name, annual_salary, start_month, target_count, hiring_plan, hiring_rate, annual_increase_percent, created_at 
         FROM staffing_roles WHERE plan_id = $1 ORDER BY start_month ASC",
        id
    )
    .fetch_all(&pool)
    .await?;

    let capital_growth: Option<crate::models::CapitalGrowthPolicy> = sqlx::query_as!(
        crate::models::CapitalGrowthPolicy,
        "SELECT id, plan_id, volatility_type, vol_min, vol_max, vol_intervals, vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta, created_at as \"created_at!\", growth_rate_percent as \"growth_rate_percent!\" FROM capital_growth_policies WHERE plan_id = $1",
        id
    )
    .fetch_optional(&pool)
    .await.ok().flatten();
    
    // Run Simulation
    let initial_cash = params.initial_cash.unwrap_or(dec!(0.0));
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
</file>

