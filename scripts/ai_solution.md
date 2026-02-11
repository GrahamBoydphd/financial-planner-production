🤖 Connecting to gemini-3-pro-preview (Paid Tier)...
<file path='backend/src/handlers/plans.rs'>
use axum::{
    extract::{Path, State, Query, Extension},
    http::StatusCode,
    Json,
};
use serde::{Deserialize};
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use crate::models::{FinancialPlan, Claims, CreatePlanRequest, UpdatePlanRequest};
use crate::errors::AppError;
use crate::projection::SimulationResult;
use crate::engine::generate_simulation;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use chrono::NaiveDate;
use std::str::FromStr;

#[derive(Deserialize)]
pub struct GetProjectionQuery {
    pub months: Option<i32>,
    pub initial_cash: Option<Decimal>,
    pub mode: Option<String>,
    pub stop_insolvency: Option<bool>,
    pub events_active: Option<bool>,
}

pub async fn create_plan(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreatePlanRequest>,
) -> Result<Json<FinancialPlan>, AppError> {
    // Length Validation
    if payload.plan_name.len() > 255 {
        return Err(AppError::ValidationError("Plan name exceeds 255 characters".to_string()));
    }
    if let Some(ref code) = payload.currency_code {
        if code.len() > 3 {
            return Err(AppError::ValidationError("Currency code must be 3 characters".to_string()));
        }
    }

    let currency = payload.currency_code.unwrap_or_else(|| "USD".to_string());
    
    let insolvency_threshold = if let Some(s) = payload.insolvency_threshold {
        Decimal::from_str(&s).map_err(|_| AppError::ValidationError("Invalid insolvency threshold".to_string()))?
    } else {
        Decimal::from(100)
    };

    let plan = sqlx::query_as!(
        FinancialPlan,
        r#"
        INSERT INTO financial_plans (company_id, plan_name, start_month, currency_code, tenant_id, insolvency_threshold) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING 
            id as "id!", company_id as "company_id!", tenant_id as "tenant_id!", 
            plan_name as "plan_name!", start_month as "start_month!", currency_code as "currency_code!", 
            initial_cash as "initial_cash!", pooling_fraction as "pooling_fraction!", 
            created_at as "created_at!", updated_at as "updated_at!",
            last_p50_net_value, insolvency_threshold as "insolvency_threshold!",
            soft_limit_active as "soft_limit_active!", soft_limit_threshold as "soft_limit_threshold!", soft_limit_fraction as "soft_limit_fraction!"
        "#,
        payload.company_id,
        payload.plan_name,
        chrono::NaiveDate::parse_from_str(&payload.start_month, "%Y-%m-%d").unwrap(),
        currency,
        claims.tenant_id,
        insolvency_threshold
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
    // Length Validation
    if let Some(ref name) = payload.plan_name {
        if name.len() > 255 {
            return Err(AppError::ValidationError("Plan name exceeds 255 characters".to_string()));
        }
    }

    let start_date = payload.start_month
        .as_deref()
        .map(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
        .flatten();

    let initial_cash = payload.initial_cash
        .as_deref()
        .map(|s| Decimal::from_str(s).ok())
        .flatten();

    let insolvency_threshold = payload.insolvency_threshold
        .as_deref()
        .map(|s| Decimal::from_str(s).ok())
        .flatten();

    let soft_limit_threshold = payload.soft_limit_threshold
        .as_deref()
        .map(|s| Decimal::from_str(s).ok())
        .flatten();

    let soft_limit_fraction = payload.soft_limit_fraction
        .as_deref()
        .map(|s| Decimal::from_str(s).ok())
        .flatten();

    let plan: Option<FinancialPlan> = sqlx::query_as!(
        FinancialPlan,
        r#"
        UPDATE financial_plans 
        SET plan_name = COALESCE($1, plan_name), 
            start_month = COALESCE($2, start_month), 
            pooling_fraction = COALESCE($3, pooling_fraction),
            initial_cash = COALESCE($4, initial_cash),
            insolvency_threshold = COALESCE($5, insolvency_threshold),
            soft_limit_active = COALESCE($6, soft_limit_active),
            soft_limit_threshold = COALESCE($7, soft_limit_threshold),
            soft_limit_fraction = COALESCE($8, soft_limit_fraction),
            updated_at = NOW() 
        WHERE id = $9 AND tenant_id = $10
        RETURNING 
            id as "id!", company_id as "company_id!", tenant_id as "tenant_id!", 
            plan_name as "plan_name!", start_month as "start_month!", currency_code as "currency_code!", 
            initial_cash as "initial_cash!", pooling_fraction as "pooling_fraction!", 
            created_at as "created_at!", updated_at as "updated_at!",
            last_p50_net_value, insolvency_threshold as "insolvency_threshold!",
            soft_limit_active as "soft_limit_active!", soft_limit_threshold as "soft_limit_threshold!", soft_limit_fraction as "soft_limit_fraction!"
        "#,
        payload.plan_name,
        start_date,
        payload.pooling_fraction,
        initial_cash,
        insolvency_threshold,
        payload.soft_limit_active,
        soft_limit_threshold,
        soft_limit_fraction,
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
        r#"
        SELECT 
            id as "id!", company_id as "company_id!", tenant_id as "tenant_id!", 
            plan_name as "plan_name!", start_month as "start_month!", currency_code as "currency_code!", 
            initial_cash as "initial_cash!", pooling_fraction as "pooling_fraction!", 
            created_at as "created_at!", updated_at as "updated_at!",
            last_p50_net_value, insolvency_threshold as "insolvency_threshold!",
            soft_limit_active as "soft_limit_active!", soft_limit_threshold as "soft_limit_threshold!", soft_limit_fraction as "soft_limit_fraction!"
        FROM financial_plans 
        WHERE tenant_id = $1 
        ORDER BY created_at DESC
        "#,
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
        r#"
        SELECT 
            id as "id!", company_id as "company_id!", tenant_id as "tenant_id!", 
            plan_name as "plan_name!", start_month as "start_month!", currency_code as "currency_code!", 
            initial_cash as "initial_cash!", pooling_fraction as "pooling_fraction!", 
            created_at as "created_at!", updated_at as "updated_at!",
            last_p50_net_value, insolvency_threshold as "insolvency_threshold!",
            soft_limit_active as "soft_limit_active!", soft_limit_threshold as "soft_limit_threshold!", soft_limit_fraction as "soft_limit_fraction!"
        FROM financial_plans 
        WHERE id = $1 AND tenant_id = $2
        "#,
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
        r#"
        SELECT 
            id as "id!", company_id as "company_id!", tenant_id as "tenant_id!", 
            plan_name as "plan_name!", start_month as "start_month!", currency_code as "currency_code!", 
            initial_cash as "initial_cash!", pooling_fraction as "pooling_fraction!", 
            created_at as "created_at!", updated_at as "updated_at!",
            last_p50_net_value, insolvency_threshold as "insolvency_threshold!",
            soft_limit_active as "soft_limit_active!", soft_limit_threshold as "soft_limit_threshold!", soft_limit_fraction as "soft_limit_fraction!"
        FROM financial_plans 
        WHERE id = $1 AND tenant_id = $2
        "#,
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    let plan = plan.ok_or(AppError::NotFound("Plan not found".to_string()))?;

    // Fetch Inputs with strict tenant isolation in subqueries
    let revenue_items: Vec<crate::models::RevenueItem> = sqlx::query_as!(
        crate::models::RevenueItem,
        r#"
        SELECT 
            id as "id!", plan_id as "plan_id!", revenue_name as "revenue_name!", source as "source!", 
            start_month as "start_month!", end_month, 
            initial_amount as "initial_amount!", growth_rate_percent as "growth_rate_percent!", 
            frequency as "frequency!", cost_of_revenue_percent, 
            volatility_type, vol_min, vol_max, vol_intervals, vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta, 
            target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level,
            created_at as "created_at!"
        FROM revenue_items 
        WHERE plan_id = $1 
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        ORDER BY start_month ASC
        "#,
        id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    let expense_items: Vec<crate::models::ExpenseItem> = sqlx::query_as!(
        crate::models::ExpenseItem,
        r#"
        SELECT 
            id as "id!", plan_id as "plan_id!", expense_name as "expense_name!", category as "category!", 
            start_month as "start_month!", end_month, 
            initial_amount as "initial_amount!", growth_rate_percent as "growth_rate_percent!", 
            frequency as "frequency!", pct_of_revenue, 
            volatility_type, vol_min, vol_max, vol_intervals, vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta, 
            target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level,
            created_at as "created_at!"
        FROM expense_items 
        WHERE plan_id = $1 
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        ORDER BY start_month ASC
        "#,
        id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    // Map new 'events' table to 'Event' struct
    // UPDATED: Fetch events linked to Plan OR Company OR Fund
    let events: Vec<crate::models::Event> = sqlx::query_as!(
        crate::models::Event,
        r#"
        SELECT 
            e.id as "id!", 
            e.plan_id, 
            e.fund_ids, 
            e.company_ids,
            e.event_name as "event_name!", 
            e.start_month, 
            e.event_category, 
            e.impact_type, 
            e.impact_value, 
            e.duration_months, 
            e.likelihood_annual_pct, 
            e.magnitude, 
            e.direction, 
            e.duration_category,
            e.is_counter_cyclic,
            e.created_at as "created_at!" 
        FROM events e
        JOIN financial_plans p ON p.id = $1
        JOIN companies c ON c.id = p.company_id
        WHERE (e.plan_id = $1 OR c.id = ANY(e.company_ids) OR c.fund_id = ANY(e.fund_ids))
        AND p.tenant_id = $2
        "#,
        id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    let capital_injections: Vec<crate::models::CapitalInjection> = sqlx::query_as!(
        crate::models::CapitalInjection,
        r#"
        SELECT id, plan_id, injection_name, amount, month, created_at 
        FROM capital_injections 
        WHERE plan_id = $1 
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        ORDER BY month ASC
        "#,
        id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    let dividend_policy: Option<crate::models::DividendPolicy> = sqlx::query_as!(
        crate::models::DividendPolicy,
        r#"
        SELECT id, plan_id, is_enabled, safety_threshold, payout_ratio, created_at, tracking_enabled as "tracking_enabled!"
        FROM dividend_policies 
        WHERE plan_id = $1
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        "#,
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await.ok().flatten();

    let credit_facility: Option<crate::models::CreditFacility> = sqlx::query_as!(
        crate::models::CreditFacility,
        r#"
        SELECT id, plan_id, facility_limit, interest_rate, is_annual_rate, created_at 
        FROM credit_facilities 
        WHERE plan_id = $1
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        "#,
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await.ok().flatten();

    let valuation_assumptions: Vec<crate::models::ValuationAssumption> = sqlx::query_as!(
        crate::models::ValuationAssumption,
        r#"
        SELECT id, plan_id, valuation_name, method, multiplier, date_applied, created_at 
        FROM valuation_assumptions 
        WHERE plan_id = $1 
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        ORDER BY date_applied DESC LIMIT 1
        "#,
        id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    let staffing_roles: Vec<crate::models::StaffingRole> = sqlx::query_as!(
        crate::models::StaffingRole,
        r#"
        SELECT 
            id as "id!", plan_id as "plan_id!", role_name as "role_name!", 
            annual_salary as "annual_salary!", start_month as "start_month!", 
            target_count as "target_count!", hiring_plan as "hiring_plan!", 
            hiring_rate, annual_increase_percent as "annual_increase_percent!", 
            created_at as "created_at!"
        FROM staffing_roles 
        WHERE plan_id = $1 
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        ORDER BY start_month ASC
        "#,
        id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    let capital_growth: Option<crate::models::CapitalGrowthPolicy> = sqlx::query_as!(
        crate::models::CapitalGrowthPolicy,
        r#"
        SELECT 
            id, plan_id, volatility_type, vol_min, vol_max, vol_intervals, vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta, 
            target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level,
            created_at as "created_at!", growth_rate_percent as "growth_rate_percent!" 
        FROM capital_growth_policies 
        WHERE plan_id = $1
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        "#,
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await.ok().flatten();
    
    let mut errors = Vec::new();

    for item in &revenue_items {
        if item.volatility_type.as_deref() == Some("nrig") {
            let alpha = item.vol_alpha.and_then(|d| d.to_f64()).unwrap_or(0.0);
            let beta = item.vol_beta.and_then(|d| d.to_f64()).unwrap_or(0.0);
            if alpha.powi(2) <= beta.powi(2) {
                errors.push(format!("Revenue '{}': NRIG requires alpha^2 > beta^2 (alpha={}, beta={})", item.revenue_name, alpha, beta));
            }
        }
    }

    for item in &expense_items {
        if item.volatility_type.as_deref() == Some("nrig") {
            let alpha = item.vol_alpha.and_then(|d| d.to_f64()).unwrap_or(0.0);
            let beta = item.vol_beta.and_then(|d| d.to_f64()).unwrap_or(0.0);
            if alpha.powi(2) <= beta.powi(2) {
                errors.push(format!("Expense '{}': NRIG requires alpha^2 > beta^2 (alpha={}, beta={})", item.expense_name, alpha, beta));
            }
        }
    }

    if let Some(ref cg) = capital_growth {
        if cg.volatility_type.as_deref() == Some("nrig") {
            let alpha = cg.vol_alpha.and_then(|d| d.to_f64()).unwrap_or(0.0);
            let beta = cg.vol_beta.and_then(|d| d.to_f64()).unwrap_or(0.0);
            if alpha.powi(2) <= beta.powi(2) {
                errors.push(format!("Capital Growth: NRIG requires alpha^2 > beta^2 (alpha={}, beta={})", alpha, beta));
            }
        }
    }

    if !errors.is_empty() {
        return Ok(Json(SimulationResult {
            errors: Some(errors),
            valuation_method: "error".to_string(),
            ..Default::default()
        }));
    }

    // Run Simulation
    let initial_cash = params.initial_cash.unwrap_or(plan.initial_cash);
    let use_monte_carlo = params.mode.unwrap_or("single".to_string()) == "monte_carlo";
    let stop_insolvency = params.stop_insolvency.unwrap_or(false);
    let events_active = params.events_active.unwrap_or(true);

    let result = generate_simulation(
        plan.company_id,
        plan.plan_name.clone(),
        plan.currency_code.clone(),
        months,
        initial_cash,
        revenue_items,
        expense_items,
        staffing_roles,
        events,
        capital_injections,
        credit_facility,
        dividend_policy,
        valuation_assumptions,
        capital_growth,
        use_monte_carlo,
        stop_insolvency,
        events_active,
        plan.pooling_fraction,
        plan.insolvency_threshold,
        plan.soft_limit_active,
        plan.soft_limit_threshold,
        plan.soft_limit_fraction
    );

    Ok(Json(result))
}
</file>

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
    pub fund_name: String, // Renamed from name
    pub currency_code: String,
    pub created_at: DateTime<Utc>,
    pub tenant_id: Uuid,
    pub is_public_template: Option<bool>,
    // New Soft Limit Defaults
    #[serde(default)]
    pub default_soft_limit_active: bool,
    #[serde(default)]
    pub default_soft_limit_threshold: Decimal,
    #[serde(default)]
    pub default_soft_limit_fraction: Decimal,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Company {
    pub id: Uuid,
    pub fund_id: Uuid,
    // tenant_id removed from here to fix duplicate field error
    pub company_name: String, // Renamed from name
    pub currency_code: String,
    pub created_at: DateTime<Utc>,
    pub industry: Option<String>,
    pub business_model: Option<String>,
    pub technology: Option<String>,
    pub tenant_id: Uuid,
}

// Add New Struct for Exchange Rates
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ExchangeRate {
    pub id: Uuid,
    pub from_currency: String,
    pub to_currency: String,
    pub rate: Decimal,
    pub rate_month: NaiveDate,
    pub created_at: DateTime<Utc>,
    pub tenant_id: Uuid,
}

// --- Phase 1 & 2: Financial Models ---

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct FinancialPlan {
    pub id: Uuid,
    pub company_id: Uuid,
    pub plan_name: String, // Renamed from name
    pub start_month: NaiveDate,
    pub currency_code: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
    pub initial_cash: Decimal,
    pub pooling_fraction: Decimal, 
    pub tenant_id: Uuid,
    pub last_p50_net_value: Option<Decimal>,
    pub insolvency_threshold: Decimal,
    // New Soft Limit Settings
    #[serde(default)]
    pub soft_limit_active: bool,
    #[serde(default)]
    pub soft_limit_threshold: Decimal,
    #[serde(default)]
    pub soft_limit_fraction: Decimal,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct RevenueItem {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub revenue_name: String, // Renamed from name
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
    pub vol_mean: Option<Decimal>, // Deprecated: Use vol_mu
    pub vol_scale: Option<Decimal>,
    pub vol_freedom: Option<Decimal>,
    pub vol_alpha: Option<Decimal>,
    pub vol_beta: Option<Decimal>,
    pub created_at: DateTime<Utc>,
    // New Distribution Architecture Fields
    pub target_mean: Option<Decimal>,
    pub vol_mu: Option<Decimal>,
    pub vol_input_mode: Option<String>,
    pub vol_fatness_level: Option<String>,
    pub vol_skew_level: Option<String>,
    pub vol_width_level: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ExpenseItem {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub expense_name: String, // Renamed from name
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
    pub vol_mean: Option<Decimal>, // Deprecated: Use vol_mu
    pub vol_scale: Option<Decimal>,
    pub vol_freedom: Option<Decimal>,
    pub vol_alpha: Option<Decimal>,
    pub vol_beta: Option<Decimal>,
    pub created_at: DateTime<Utc>,
    // New Distribution Architecture Fields
    pub target_mean: Option<Decimal>,
    pub vol_mu: Option<Decimal>,
    pub vol_input_mode: Option<String>,
    pub vol_fatness_level: Option<String>,
    pub vol_skew_level: Option<String>,
    pub vol_width_level: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct CapitalInjection {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub injection_name: String, // Renamed from name
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
    pub tracking_enabled: bool,
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
pub struct Event {
    pub id: Uuid,
    pub plan_id: Option<Uuid>,
    pub fund_ids: Option<Vec<Uuid>>, // Changed to Array
    pub company_ids: Option<Vec<Uuid>>, // Changed to Array
    pub event_name: String, // Renamed from shock_name
    pub start_month: Option<i32>, // Renamed from shock_month, Relaxed
    pub event_category: Option<String>,
    pub impact_type: Option<String>, // Relaxed
    pub impact_value: Option<Decimal>, // Relaxed
    pub duration_months: Option<i32>,
    pub likelihood_annual_pct: Option<Decimal>,
    pub magnitude: Option<String>,
    pub direction: Option<String>,
    pub duration_category: Option<String>,
    pub is_counter_cyclic: Option<bool>,
    pub created_at: DateTime<Utc>,
}

// Legacy struct for backward compatibility with projection engine
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct EventShock {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub shock_name: String,
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
    pub vol_mean: Option<Decimal>, // Deprecated: Use vol_mu
    pub vol_scale: Option<Decimal>,
    pub vol_freedom: Option<Decimal>,
    pub vol_alpha: Option<Decimal>,
    pub vol_beta: Option<Decimal>,
    pub created_at: Option<DateTime<Utc>>,
    pub growth_rate_percent: Decimal,
    // New Distribution Architecture Fields
    pub target_mean: Option<Decimal>,
    pub vol_mu: Option<Decimal>,
    pub vol_input_mode: Option<String>,
    pub vol_fatness_level: Option<String>,
    pub vol_skew_level: Option<String>,
    pub vol_width_level: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct CreateFundRequest {
    pub fund_name: String,
    pub currency_code: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct UpdateFundRequest {
    pub fund_name: String,
    pub currency_code: String,
}

#[derive(Deserialize, Debug)]
pub struct CreateCompanyRequest {
    pub fund_id: Uuid,
    pub tenant_id: Uuid,
    pub company_name: String,
    pub business_model: Option<String>,
    pub industry: Option<String>,
    pub technology: Option<String>,
    pub currency_code: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct UpdateCompanyRequest {
    pub company_name: String,
    pub business_model: Option<String>,
    pub industry: Option<String>,
    pub technology: Option<String>,
    pub currency_code: String,
}

// --- Point 9: Staffing & Payroll ---
#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct StaffingRole {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub role_name: String,
    pub annual_salary: Decimal,
    pub start_month: i32,
    pub target_count: i32, 
    pub hiring_plan: String, 
    pub hiring_rate: Option<i32>, 
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
    pub username: String,
    pub tenant_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub user_id: Uuid,
    pub tenant_id: Uuid,
    pub exp: usize,
}

// --- Fund Plans ---

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FundPlan {
    pub id: Uuid,
    pub fund_id: Uuid,
    pub tenant_id: Uuid,
    pub plan_name: String,
    pub selected_plans: serde_json::Value, // Maps to JSONB
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFundPlanRequest {
    pub plan_name: String,
    pub selected_plans: serde_json::Value,
}

// --- Plan Requests ---

#[derive(Deserialize)]
pub struct CreatePlanRequest {
    pub company_id: Uuid,
    pub plan_name: String,
    pub start_month: String, // YYYY-MM-01
    pub currency_code: Option<String>,
    pub insolvency_threshold: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdatePlanRequest {
    pub plan_name: Option<String>,
    pub start_month: Option<String>,
    pub pooling_fraction: Option<Decimal>,
    pub initial_cash: Option<String>,
    pub insolvency_threshold: Option<String>,
    // New fields for Soft Limit
    pub soft_limit_active: Option<bool>,
    pub soft_limit_threshold: Option<String>,
    pub soft_limit_fraction: Option<String>,
}

// --- Event Requests ---

#[derive(Deserialize, Debug)]
#[serde(untagged)]
pub enum EventPayload {
    Fixed {
        start_month: i32,
        impact_value: String,
        duration_months: Option<i32>,
    },
    Stochastic {
        occurrence_probability: String,
        magnitude: String,
        direction: String,
        duration: String, // Maps to duration_category
        is_counter_cyclic: Option<bool>,
    },
}

#[derive(Deserialize, Debug)]
pub struct CreateEventRequest {
    pub scope: String, // "global", "local", "plan"
    pub target_ids: Vec<Uuid>, // Changed to Array
    pub event_name: String,
    pub event_type: String, // Renamed from shock_type
    #[serde(flatten)]
    pub data: EventPayload,
}
</file>

