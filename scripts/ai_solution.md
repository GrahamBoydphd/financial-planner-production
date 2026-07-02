🤖 Generating standard response via gemini-3.1-pro-preview...
```xml
<file path="backend/src/handlers/plans.rs">
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
        INSERT INTO financial_plans (company_id, plan_name, start_month, currency_code, tenant_id, insolvency_threshold, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING 
            id as "id!", company_id as "company_id!", tenant_id as "tenant_id!", 
            plan_name as "plan_name!", description, start_month as "start_month!", currency_code as "currency_code!", 
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
        insolvency_threshold,
        payload.description
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
            description = COALESCE($9, description),
            updated_at = NOW() 
        WHERE id = $10 AND tenant_id = $11
        RETURNING 
            id as "id!", company_id as "company_id!", tenant_id as "tenant_id!", 
            plan_name as "plan_name!", description, start_month as "start_month!", currency_code as "currency_code!", 
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
        payload.description,
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
            plan_name as "plan_name!", description, start_month as "start_month!", currency_code as "currency_code!", 
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
            plan_name as "plan_name!", description, start_month as "start_month!", currency_code as "currency_code!", 
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
    let months = params.months.unwrap_or(120);
    if months > 1200 {
        return Err(AppError::ValidationError("Simulation limited to 100 years (1200 months)".into()));
    }

    // Fetch Plan Info
    let plan: Option<FinancialPlan> = sqlx::query_as!(
        FinancialPlan,
        r#"
        SELECT 
            id as "id!", company_id as "company_id!", tenant_id as "tenant_id!", 
            plan_name as "plan_name!", description, start_month as "start_month!", currency_code as "currency_code!", 
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
    let revenue_items: Vec<crate::handlers::fund_simulation::DbRevenueItem> = sqlx::query_as!(
        crate::handlers::fund_simulation::DbRevenueItem,
        r#"
        SELECT 
            id as "id!", revenue_name as "revenue_name!", 
            start_month as "start_month!", end_month, 
            initial_amount as "initial_amount!", 
            frequency as "frequency!",
            trigger_strategy
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

    let revenue_phases: Vec<crate::handlers::fund_simulation::DbRevenuePhase> = sqlx::query_as!(
        crate::handlers::fund_simulation::DbRevenuePhase,
        r#"
        SELECT 
            p.id as "id!", p.revenue_item_id as "revenue_item_id!", p.phase_sequence as "phase_sequence!", 
            p.trigger_month as "trigger_month!", p.growth_rate_percent as "growth_rate_percent!", 
            p.cost_of_revenue_percent,
            p.trigger_operator, p.trigger_threshold
        FROM revenue_item_phases p
        JOIN revenue_items i ON i.id = p.revenue_item_id
        WHERE i.plan_id = $1
        ORDER BY p.phase_sequence ASC
        "#,
        id
    )
    .fetch_all(&pool)
    .await?;

    let revenue_policies: Vec<crate::handlers::fund_simulation::VolatilityPolicyData> = sqlx::query_as!(
        crate::handlers::fund_simulation::VolatilityPolicyData,
        r#"
        SELECT 
            v.revenue_item_phase_id as "phase_id!", v.mode_name as "mode_name!", 
            v.volatility_type as "volatility_type!", v.vol_min, v.vol_max, v.vol_intervals,
            v.vol_mean, v.vol_scale, v.vol_freedom, v.vol_alpha, v.vol_beta
        FROM revenue_item_volatility_policies v
        JOIN revenue_item_phases p ON p.id = v.revenue_item_phase_id
        JOIN revenue_items i ON i.id = p.revenue_item_id
        WHERE i.plan_id = $1
        "#,
        id
    )
    .fetch_all(&pool)
    .await?;

    let expense_items: Vec<crate::handlers::fund_simulation::DbExpenseItem> = sqlx::query_as!(
        crate::handlers::fund_simulation::DbExpenseItem,
        r#"
        SELECT 
            id as "id!", expense_name as "expense_name!", category as "category!",
            start_month as "start_month!", end_month, 
            initial_amount as "initial_amount!", 
            frequency as "frequency!",
            trigger_strategy
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

    let expense_phases: Vec<crate::handlers::fund_simulation::DbExpensePhase> = sqlx::query_as!(
        crate::handlers::fund_simulation::DbExpensePhase,
        r#"
        SELECT 
            p.id as "id!", p.expense_item_id as "expense_item_id!", p.phase_sequence as "phase_sequence!", 
            p.trigger_month as "trigger_month!", p.growth_rate_percent as "growth_rate_percent!", 
            p.pct_of_revenue,
            p.trigger_operator, p.trigger_threshold
        FROM expense_item_phases p
        JOIN expense_items i ON i.id = p.expense_item_id
        WHERE i.plan_id = $1
        ORDER BY p.phase_sequence ASC
        "#,
        id
    )
    .fetch_all(&pool)
    .await?;

    let expense_policies: Vec<crate::handlers::fund_simulation::VolatilityPolicyData> = sqlx::query_as!(
        crate::handlers::fund_simulation::VolatilityPolicyData,
        r#"
        SELECT 
            v.expense_item_phase_id as "phase_id!", v.mode_name as "mode_name!", 
            v.volatility_type as "volatility_type!", v.vol_min, v.vol_max, v.vol_intervals,
            v.vol_mean, v.vol_scale, v.vol_freedom, v.vol_alpha, v.vol_beta
        FROM expense_item_volatility_policies v
        JOIN expense_item_phases p ON p.id = v.expense_item_phase_id
        JOIN expense_items i ON i.id = p.expense_item_id
        WHERE i.plan_id = $1
        "#,
        id
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

    // Extract fields to move into closure
    let company_id = plan.company_id;
    let plan_name = plan.plan_name.clone();
    let currency_code = plan.currency_code.clone();
    let pooling_fraction = plan.pooling_fraction;
    let insolvency_threshold = plan.insolvency_threshold;
    let soft_limit_active = plan.soft_limit_active;
    let soft_limit_threshold = plan.soft_limit_threshold;
    let soft_limit_fraction = plan.soft_limit_fraction;

    let result = tokio::task::spawn_blocking(move || {
        generate_simulation(
            company_id,
            plan_name,
            currency_code,
            months,
            initial_cash,
            revenue_items,
            revenue_phases,
            revenue_policies,
            expense_items,
            expense_phases,
            expense_policies,
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
            pooling_fraction,
            insolvency_threshold,
            soft_limit_active,
            soft_limit_threshold,
            soft_limit_fraction
        )
    }).await.map_err(|e| AppError::InternalServerError(format!("Simulation execution failed: {}", e)))?;

    Ok(Json(result))
}
</file>

<file path="backend/src/handlers/revenue.rs">
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
    Extension,
};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use crate::models::Claims;
use crate::errors::AppError;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use std::str::FromStr;

trait UnwrapOrZero {
    fn unwrap_or_zero(self) -> i32;
}
impl UnwrapOrZero for i32 {
    fn unwrap_or_zero(self) -> i32 { self }
}
impl UnwrapOrZero for Option<i32> {
    fn unwrap_or_zero(self) -> i32 { self.unwrap_or(0) }
}

trait ToDecimal {
    fn to_decimal(&self) -> Decimal;
}
impl ToDecimal for String {
    fn to_decimal(&self) -> Decimal { Decimal::from_str(self).unwrap_or(Decimal::ZERO) }
}
impl ToDecimal for Option<String> {
    fn to_decimal(&self) -> Decimal { self.as_deref().and_then(|s| Decimal::from_str(s).ok()).unwrap_or(Decimal::ZERO) }
}
impl ToDecimal for Decimal {
    fn to_decimal(&self) -> Decimal { *self }
}
impl ToDecimal for Option<Decimal> {
    fn to_decimal(&self) -> Decimal { self.unwrap_or(Decimal::ZERO) }
}

trait ToOptionDecimal {
    fn to_option_decimal(&self) -> Option<Decimal>;
}
impl ToOptionDecimal for String {
    fn to_option_decimal(&self) -> Option<Decimal> { Decimal::from_str(self).ok() }
}
impl ToOptionDecimal for Option<String> {
    fn to_option_decimal(&self) -> Option<Decimal> { self.as_deref().and_then(|s| Decimal::from_str(s).ok()) }
}
impl ToOptionDecimal for Decimal {
    fn to_option_decimal(&self) -> Option<Decimal> { Some(*self) }
}
impl ToOptionDecimal for Option<Decimal> {
    fn to_option_decimal(&self) -> Option<Decimal> { *self }
}

#[derive(Deserialize)]
pub struct VolatilityConfigInput {
    pub mode_name: String,
    pub volatility_type: String,
    pub vol_min: Option<String>,
    pub vol_max: Option<String>,
    pub vol_intervals: Option<i32>,
    pub target_mean: String,
    pub vol_scale: Option<String>,
    pub vol_freedom: Option<String>,
    pub vol_alpha: Option<String>,
    pub vol_beta: Option<String>,
    pub vol_input_mode: String,
    pub vol_fatness_level: Option<String>,
    pub vol_skew_level: Option<String>,
    pub vol_width_level: Option<String>,
}

#[derive(Deserialize)]
pub struct RevenuePhaseInput {
    pub phase_sequence: i32,
    pub trigger_month: i32,
    pub growth_rate_percent: String,
    pub cost_of_revenue_percent: Option<String>,
    pub volatility_configs: Vec<VolatilityConfigInput>,
}

#[derive(Deserialize)]
pub struct CreateRevenueRequest {
    pub plan_id: Uuid,
    pub revenue_name: String,
    pub source: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: String,
    pub frequency: String,
    pub phases: Vec<RevenuePhaseInput>,
}

#[derive(Deserialize)]
pub struct UpdateRevenueRequest {
    pub revenue_name: String,
    pub source: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: String,
    pub frequency: String,
    pub phases: Vec<RevenuePhaseInput>,
}

#[derive(Serialize)]
pub struct RevenuePolicyResponse {
    pub id: Uuid,
    pub phase_id: Uuid,
    pub mode_name: String,
    pub volatility_type: String,
    pub vol_min: Option<Decimal>,
    pub vol_max: Option<Decimal>,
    pub vol_intervals: Option<i32>,
    pub vol_mean: Option<Decimal>,
    pub vol_scale: Option<Decimal>,
    pub vol_freedom: Option<Decimal>,
    pub vol_alpha: Option<Decimal>,
    pub vol_beta: Option<Decimal>,
    pub target_mean: Decimal,
    pub vol_mu: Decimal,
    pub vol_input_mode: String,
    pub vol_fatness_level: Option<String>,
    pub vol_skew_level: Option<String>,
    pub vol_width_level: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize)]
pub struct RevenuePhaseResponse {
    pub id: Uuid,
    pub revenue_item_id: Uuid,
    pub phase_sequence: i32,
    pub trigger_month: i32,
    pub growth_rate_percent: Decimal,
    pub cost_of_revenue_percent: Option<Decimal>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub volatility_configs: Vec<RevenuePolicyResponse>,
}

#[derive(Serialize)]
pub struct RevenueItemTreeResponse {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub revenue_name: String,
    pub source: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: Decimal,
    pub frequency: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub phases: Vec<RevenuePhaseResponse>,
}

// Helper to calculate NRIG parameters
fn calculate_nrig_params(
    mode: &str,
    fatness: Option<&str>,
    skew: Option<&str>,
    width: Option<&str>,
    target_mean: Decimal,
    inp_alpha: Option<Decimal>,
    inp_beta: Option<Decimal>,
    inp_scale: Option<Decimal>,
) -> Result<(Option<Decimal>, Option<Decimal>, Option<Decimal>, Decimal), AppError> {
    let target_mean_f = target_mean.to_f64().unwrap_or(0.0);

    if mode == "simple" {
        // 1. Alpha (Fatness)
        let alpha_f: f64 = match fatness.unwrap_or("heavy") {
            "skinny" => 100.0,
            "normal" => 50.0,
            "moderate" => 2.0,
            "heavy" => 0.5,
            unrecognized => {
                eprintln!("ERROR: Unrecognized fatness option: {}. Defaulting alpha to 50.0 (normal).", unrecognized);
                50.0
            }
        };

        // 2. Beta (Skew)
        let skew_factor: f64 = match skew.unwrap_or("symmetric") {
            "strong_downside" => -0.9,
            "medium_downside" => -0.4,
            "symmetric" => 0.0,
            "medium_upside" => 0.4,
            "strong_upside" => 0.9,
            unrecognized => {
                eprintln!("ERROR: Unrecognized skew option: {}. Defaulting skew to 0.0 (symmetric).", unrecognized);
                0.0
            }
        };
        let beta_f: f64 = alpha_f * skew_factor;

        // 3. Scale/Delta (Width)
        let sigma: f64 = match width.unwrap_or("medium") {
            "very_low" => 1.0,
            "low" => 3.2,
            "medium" => 10.0,
            "high" => 20.0,
            "very_high" => 32.0,
            unrecognized => {
                eprintln!("ERROR: Unrecognized width option: {}. Defaulting width to 10.0 (medium).", unrecognized);
                10.0
            }
        };
        
        // Delta = Sigma^2 * Alpha * (1 - Factor^2)^1.5
        let term = (1.0 - skew_factor.powi(2)).powf(1.5);
        let delta_f = sigma.powi(2) * alpha_f * term;

        // 4. Mu
        // Mu = Target - Delta * (Beta / sqrt(Alpha^2 - Beta^2))
        let denom = (alpha_f.powi(2) - beta_f.powi(2)).sqrt();
        let drift = if denom > 0.0 {
            delta_f * (beta_f / denom)
        } else {
            0.0
        };
        let mu_f = target_mean_f - drift;

        Ok((
            Decimal::from_f64_retain(alpha_f),
            Decimal::from_f64_retain(beta_f),
            Decimal::from_f64_retain(delta_f),
            Decimal::from_f64_retain(mu_f).unwrap_or(target_mean),
        ))
    } else {
        // Advanced Mode
        let alpha = inp_alpha.ok_or_else(|| AppError::ValidationError("Alpha required for advanced NRIG".to_string()))?;
        let beta = inp_beta.ok_or_else(|| AppError::ValidationError("Beta required for advanced NRIG".to_string()))?;
        let scale = inp_scale.ok_or_else(|| AppError::ValidationError("Scale required for advanced NRIG".to_string()))?;

        let alpha_f = alpha.to_f64().unwrap_or(0.0);
        let beta_f = beta.to_f64().unwrap_or(0.0);
        let scale_f = scale.to_f64().unwrap_or(0.0);

        if alpha_f.abs() <= beta_f.abs() {
             return Err(AppError::ValidationError(format!(
                "NRIG Error: Alpha ({}) must be greater than absolute Beta ({})",
                alpha_f, beta_f.abs()
            )));
        }

        let denom = (alpha_f.powi(2) - beta_f.powi(2)).sqrt();
        let drift = if denom > 0.0 {
            scale_f * (beta_f / denom)
        } else {
            0.0
        };
        let mu_f = target_mean_f - drift;

        Ok((Some(alpha), Some(beta), Some(scale), Decimal::from_f64_retain(mu_f).unwrap_or(target_mean)))
    }
}

pub async fn create_revenue_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateRevenueRequest>,
) -> Result<Json<RevenueItemTreeResponse>, AppError> {
    if payload.phases.is_empty() {
        return Err(AppError::ValidationError("At least one phase must be provided.".to_string()));
    }

    // Length Validation
    if payload.revenue_name.len() > 255 {
        return Err(AppError::ValidationError("Name exceeds 255 characters".to_string()));
    }
    if payload.source.len() > 255 {
        return Err(AppError::ValidationError("Source exceeds 255 characters".to_string()));
    }

    // Parse Decimals from Strings
    let initial_amount = Decimal::from_str(&payload.initial_amount)
        .map_err(|_| AppError::ValidationError("Invalid format for initial_amount".to_string()))?;
    
    if initial_amount < Decimal::ZERO {
        return Err(AppError::ValidationError("Initial amount must be non-negative".to_string()));
    }

    let valid_frequencies = ["monthly", "quarterly", "annually", "one_time"];
    if !valid_frequencies.contains(&payload.frequency.as_str()) {
        return Err(AppError::ValidationError(format!(
            "Invalid frequency: '{}'. Must be one of: {:?}", 
            payload.frequency, valid_frequencies
        )));
    }

    // Verify plan ownership
    let plan_exists: Option<_> = sqlx::query!(
        "SELECT id FROM financial_plans WHERE id = $1 AND tenant_id = $2",
        payload.plan_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    if plan_exists.is_none() {
        return Err(AppError::NotFound("Financial plan not found".to_string()));
    }

    let mut tx = pool.begin().await.map_err(|e| AppError::ValidationError(format!("Failed to start transaction: {}", e)))?;

    let item = sqlx::query!(
        r#"
        INSERT INTO revenue_items (
            plan_id, revenue_name, source, start_month, end_month, initial_amount, frequency
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING 
            id, plan_id, revenue_name, source, 
            start_month, end_month, 
            initial_amount, frequency, 
            created_at
        "#,
        payload.plan_id, payload.revenue_name, payload.source, payload.start_month, payload.end_month, 
        initial_amount, payload.frequency
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::ValidationError(format!("Database insert failed: {}", e)))?;

    let mut phases_resp = Vec::new();

    for phase_input in payload.phases {
        let growth_rate_percent = Decimal::from_str(&phase_input.growth_rate_percent)
            .map_err(|_| AppError::ValidationError("Invalid format for growth_rate_percent".to_string()))?;

        let cost_of_revenue_percent = match &phase_input.cost_of_revenue_percent {
            Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for cost_of_revenue_percent".to_string()))?),
            None => None,
        };

        let growth_rate_percent_str = growth_rate_percent.to_string();
        let cost_of_revenue_percent_str = cost_of_revenue_percent.as_ref().map(|v| v.to_string());

        let phase = sqlx::query!(
            r#"
            INSERT INTO revenue_item_phases (
                revenue_item_id, phase_sequence, trigger_month, growth_rate_percent, cost_of_revenue_percent
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id, revenue_item_id, phase_sequence, trigger_month, growth_rate_percent, cost_of_revenue_percent, created_at
            "#,
            item.id, phase_input.phase_sequence, phase_input.trigger_month, growth_rate_percent_str, cost_of_revenue_percent_str
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::ValidationError(format!("Failed to insert phase: {}", e)))?;

        let mut policies_resp = Vec::new();

        for config in phase_input.volatility_configs {
            let target_mean = Decimal::from_str(&config.target_mean)
                .map_err(|_| AppError::ValidationError("Invalid format for target_mean".to_string()))?;

            let vol_min = match &config.vol_min {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_min".to_string()))?),
                None => None,
            };

            let vol_max = match &config.vol_max {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_max".to_string()))?),
                None => None,
            };

            let vol_scale = match &config.vol_scale {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_scale".to_string()))?),
                None => None,
            };

            let vol_freedom = match &config.vol_freedom {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_freedom".to_string()))?),
                None => None,
            };

            let vol_alpha = match &config.vol_alpha {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_alpha".to_string()))?),
                None => None,
            };

            let vol_beta = match &config.vol_beta {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_beta".to_string()))?),
                None => None,
            };

            let mut vol_mu = target_mean;
            let mut final_alpha = vol_alpha;
            let mut final_beta = vol_beta;
            let mut final_scale = vol_scale;

            let valid_vol_types = ["normal", "student_t", "nrig", "flat"];
            if !valid_vol_types.contains(&config.volatility_type.as_str()) {
                return Err(AppError::ValidationError(format!(
                    "Invalid volatility_type: '{}'. Must be one of: {:?}", 
                    config.volatility_type, valid_vol_types
                )));
            }

            if config.volatility_type == "nrig" {
                let (a, b, s, m) = calculate_nrig_params(
                    &config.vol_input_mode,
                    config.vol_fatness_level.as_deref(),
                    config.vol_skew_level.as_deref(),
                    config.vol_width_level.as_deref(),
                    target_mean,
                    vol_alpha,
                    vol_beta,
                    vol_scale
                )?;
                final_alpha = a;
                final_beta = b;
                final_scale = s;
                vol_mu = m;
            }

            let policy = sqlx::query!(
                r#"
                INSERT INTO revenue_item_volatility_policies (
                    revenue_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                    target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
                )
                RETURNING id, revenue_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                    target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level, created_at
                "#,
                phase.id, config.mode_name, config.volatility_type, vol_min, vol_max, config.vol_intervals,
                Some(vol_mu), final_scale, vol_freedom, final_alpha, final_beta,
                target_mean, vol_mu, config.vol_input_mode, config.vol_fatness_level, config.vol_skew_level, config.vol_width_level
            )
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| AppError::ValidationError(format!("Failed to insert volatility policy: {}", e)))?;

            policies_resp.push(RevenuePolicyResponse {
                id: policy.id,
                phase_id: policy.revenue_item_phase_id,
                mode_name: policy.mode_name,
                volatility_type: policy.volatility_type,
                vol_min: policy.vol_min.to_option_decimal(),
                vol_max: policy.vol_max.to_option_decimal(),
                vol_intervals: policy.vol_intervals,
                vol_mean: policy.vol_mean.to_option_decimal(),
                vol_scale: policy.vol_scale.to_option_decimal(),
                vol_freedom: policy.vol_freedom.to_option_decimal(),
                vol_alpha: policy.vol_alpha.to_option_decimal(),
                vol_beta: policy.vol_beta.to_option_decimal(),
                target_mean: policy.target_mean.to_decimal(),
                vol_mu: policy.vol_mu.to_decimal(),
                vol_input_mode: policy.vol_input_mode.unwrap_or_default(),
                vol_fatness_level: policy.vol_fatness_level,
                vol_skew_level: policy.vol_skew_level,
                vol_width_level: policy.vol_width_level,
                created_at: policy.created_at,
            });
        }

        phases_resp.push(RevenuePhaseResponse {
            id: phase.id,
            revenue_item_id: phase.revenue_item_id,
            phase_sequence: phase.phase_sequence.unwrap_or_zero(),
            trigger_month: phase.trigger_month.unwrap_or_zero(),
            growth_rate_percent: phase.growth_rate_percent.to_decimal(),
            cost_of_revenue_percent: phase.cost_of_revenue_percent.to_option_decimal(),
            created_at: phase.created_at,
            volatility_configs: policies_resp,
        });
    }

    tx.commit().await.map_err(|e| AppError::ValidationError(format!("Failed to commit transaction: {}", e)))?;

    Ok(Json(RevenueItemTreeResponse {
        id: item.id,
        plan_id: item.plan_id,
        revenue_name: item.revenue_name,
        source: item.source,
        start_month: item.start_month.unwrap_or_zero(),
        end_month: item.end_month,
        initial_amount: item.initial_amount.to_decimal(),
        frequency: item.frequency,
        created_at: item.created_at,
        phases: phases_resp,
    }))
}

pub async fn get_revenue_items(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<Vec<RevenueItemTreeResponse>>, AppError> {
    let items = sqlx::query!(
        r#"
        SELECT 
            id, plan_id, revenue_name, source, 
            start_month, end_month, 
            initial_amount, frequency, 
            created_at
        FROM revenue_items 
        WHERE plan_id = $1 
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        ORDER BY start_month ASC
        "#,
        plan_id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    let mut responses = Vec::new();

    if !items.is_empty() {
        let item_ids: Vec<Uuid> = items.iter().map(|i| i.id).collect();
        
        let phases = sqlx::query!(
            r#"
            SELECT 
                id, revenue_item_id, phase_sequence, trigger_month, 
                growth_rate_percent, cost_of_revenue_percent, created_at
            FROM revenue_item_phases
            WHERE revenue_item_id = ANY($1)
            ORDER BY phase_sequence ASC
            "#,
            &item_ids
        )
        .fetch_all(&pool)
        .await?;

        let phase_ids: Vec<Uuid> = phases.iter().map(|p| p.id).collect();

        let policies = sqlx::query!(
            r#"
            SELECT 
                id, revenue_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level,
                created_at
            FROM revenue_item_volatility_policies
            WHERE revenue_item_phase_id = ANY($1)
            "#,
            &phase_ids
        )
        .fetch_all(&pool)
        .await?;

        for item in items {
            let mut item_phases = Vec::new();
            
            for phase in phases.iter().filter(|p| p.revenue_item_id == item.id) {
                let phase_policies = policies.iter().filter(|pol| pol.revenue_item_phase_id == phase.id).map(|pol| RevenuePolicyResponse {
                    id: pol.id,
                    phase_id: pol.revenue_item_phase_id,
                    mode_name: pol.mode_name.clone(),
                    volatility_type: pol.volatility_type.clone(),
                    vol_min: pol.vol_min.to_option_decimal(),
                    vol_max: pol.vol_max.to_option_decimal(),
                    vol_intervals: pol.vol_intervals,
                    vol_mean: pol.vol_mean.to_option_decimal(),
                    vol_scale: pol.vol_scale.to_option_decimal(),
                    vol_freedom: pol.vol_freedom.to_option_decimal(),
                    vol_alpha: pol.vol_alpha.to_option_decimal(),
                    vol_beta: pol.vol_beta.to_option_decimal(),
                    target_mean: pol.target_mean.to_decimal(),
                    vol_mu: pol.vol_mu.to_decimal(),
                    vol_input_mode: pol.vol_input_mode.clone().unwrap_or_default(),
                    vol_fatness_level: pol.vol_fatness_level.clone(),
                    vol_skew_level: pol.vol_skew_level.clone(),
                    vol_width_level: pol.vol_width_level.clone(),
                    created_at: pol.created_at,
                }).collect();

                item_phases.push(RevenuePhaseResponse {
                    id: phase.id,
                    revenue_item_id: phase.revenue_item_id,
                    phase_sequence: phase.phase_sequence.unwrap_or_zero(),
                    trigger_month: phase.trigger_month.unwrap_or_zero(),
                    growth_rate_percent: phase.growth_rate_percent.to_decimal(),
                    cost_of_revenue_percent: phase.cost_of_revenue_percent.to_option_decimal(),
                    created_at: phase.created_at,
                    volatility_configs: phase_policies,
                });
            }

            responses.push(RevenueItemTreeResponse {
                id: item.id,
                plan_id: item.plan_id,
                revenue_name: item.revenue_name.clone(),
                source: item.source.clone(),
                start_month: item.start_month.unwrap_or_zero(),
                end_month: item.end_month,
                initial_amount: item.initial_amount.to_decimal(),
                frequency: item.frequency.clone(),
                created_at: item.created_at,
                phases: item_phases,
            });
        }
    }

    Ok(Json(responses))
}

pub async fn update_revenue_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateRevenueRequest>,
) -> Result<Json<RevenueItemTreeResponse>, AppError> {
    if payload.phases.is_empty() {
        return Err(AppError::ValidationError("At least one phase must be provided.".to_string()));
    }

    // Length Validation
    if payload.revenue_name.len() > 255 {
        return Err(AppError::ValidationError("Name exceeds 255 characters".to_string()));
    }
    if payload.source.len() > 255 {
        return Err(AppError::ValidationError("Source exceeds 255 characters".to_string()));
    }

    // Parse Decimals from Strings
    let initial_amount = Decimal::from_str(&payload.initial_amount)
        .map_err(|_| AppError::ValidationError("Invalid format for initial_amount".to_string()))?;
    
    if initial_amount < Decimal::ZERO {
        return Err(AppError::ValidationError("Initial amount must be non-negative".to_string()));
    }

    let valid_frequencies = ["monthly", "quarterly", "annually", "one_time"];
    if !valid_frequencies.contains(&payload.frequency.as_str()) {
        return Err(AppError::ValidationError(format!(
            "Invalid frequency: '{}'. Must be one of: {:?}", 
            payload.frequency, valid_frequencies
        )));
    }

    let mut tx = pool.begin().await.map_err(|e| AppError::ValidationError(format!("Failed to start transaction: {}", e)))?;

    let item = sqlx::query!(
        r#"
        UPDATE revenue_items SET
            revenue_name = $1, source = $2, start_month = $3, end_month = $4,
            initial_amount = $5, frequency = $6
        WHERE id = $7
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $8)
        RETURNING 
            id, plan_id, revenue_name, source, 
            start_month, end_month, 
            initial_amount, frequency, 
            created_at
        "#,
        payload.revenue_name, payload.source, payload.start_month, payload.end_month, 
        initial_amount, payload.frequency,
        id,
        claims.tenant_id
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::ValidationError(format!("Database update failed: {}", e)))?;

    // Delete existing policies and phases
    sqlx::query!("DELETE FROM revenue_item_volatility_policies WHERE revenue_item_phase_id IN (SELECT id FROM revenue_item_phases WHERE revenue_item_id = $1)", id)
        .execute(&mut *tx).await?;
    sqlx::query!("DELETE FROM revenue_item_phases WHERE revenue_item_id = $1", id)
        .execute(&mut *tx).await?;

    let mut phases_resp = Vec::new();

    for phase_input in payload.phases {
        let growth_rate_percent = Decimal::from_str(&phase_input.growth_rate_percent)
            .map_err(|_| AppError::ValidationError("Invalid format for growth_rate_percent".to_string()))?;

        let cost_of_revenue_percent = match &phase_input.cost_of_revenue_percent {
            Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for cost_of_revenue_percent".to_string()))?),
            None => None,
        };

        let growth_rate_percent_str = growth_rate_percent.to_string();
        let cost_of_revenue_percent_str = cost_of_revenue_percent.as_ref().map(|v| v.to_string());

        let phase = sqlx::query!(
            r#"
            INSERT INTO revenue_item_phases (
                revenue_item_id, phase_sequence, trigger_month, growth_rate_percent, cost_of_revenue_percent
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id, revenue_item_id, phase_sequence, trigger_month, growth_rate_percent, cost_of_revenue_percent, created_at
            "#,
            item.id, phase_input.phase_sequence, phase_input.trigger_month, growth_rate_percent_str, cost_of_revenue_percent_str
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::ValidationError(format!("Failed to insert phase: {}", e)))?;

        let mut policies_resp = Vec::new();

        for config in phase_input.volatility_configs {
            let target_mean = Decimal::from_str(&config.target_mean)
                .map_err(|_| AppError::ValidationError("Invalid format for target_mean".to_string()))?;

            let vol_min = match &config.vol_min {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_min".to_string()))?),
                None => None,
            };

            let vol_max = match &config.vol_max {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_max".to_string()))?),
                None => None,
            };

            let vol_scale = match &config.vol_scale {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_scale".to_string()))?),
                None => None,
            };

            let vol_freedom = match &config.vol_freedom {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_freedom".to_string()))?),
                None => None,
            };

            let vol_alpha = match &config.vol_alpha {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_alpha".to_string()))?),
                None => None,
            };

            let vol_beta = match &config.vol_beta {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_beta".to_string()))?),
                None => None,
            };

            let mut vol_mu = target_mean;
            let mut final_alpha = vol_alpha;
            let mut final_beta = vol_beta;
            let mut final_scale = vol_scale;

            let valid_vol_types = ["normal", "student_t", "nrig", "flat"];
            if !valid_vol_types.contains(&config.volatility_type.as_str()) {
                return Err(AppError::ValidationError(format!(
                    "Invalid volatility_type: '{}'. Must be one of: {:?}", 
                    config.volatility_type, valid_vol_types
                )));
            }

            if config.volatility_type == "nrig" {
                let (a, b, s, m) = calculate_nrig_params(
                    &config.vol_input_mode,
                    config.vol_fatness_level.as_deref(),
                    config.vol_skew_level.as_deref(),
                    config.vol_width_level.as_deref(),
                    target_mean,
                    vol_alpha,
                    vol_beta,
                    vol_scale
                )?;
                final_alpha = a;
                final_beta = b;
                final_scale = s;
                vol_mu = m;
            }

            let policy = sqlx::query!(
                r#"
                INSERT INTO revenue_item_volatility_policies (
                    revenue_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                    target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
                )
                RETURNING id, revenue_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                    target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level, created_at
                "#,
                phase.id, config.mode_name, config.volatility_type, vol_min, vol_max, config.vol_intervals,
                Some(vol_mu), final_scale, vol_freedom, final_alpha, final_beta,
                target_mean, vol_mu, config.vol_input_mode, config.vol_fatness_level, config.vol_skew_level, config.vol_width_level
            )
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| AppError::ValidationError(format!("Failed to insert volatility policy: {}", e)))?;

            policies_resp.push(RevenuePolicyResponse {
                id: policy.id,
                phase_id: policy.revenue_item_phase_id,
                mode_name: policy.mode_name,
                volatility_type: policy.volatility_type,
                vol_min: policy.vol_min.to_option_decimal(),
                vol_max: policy.vol_max.to_option_decimal(),
                vol_intervals: policy.vol_intervals,
                vol_mean: policy.vol_mean.to_option_decimal(),
                vol_scale: policy.vol_scale.to_option_decimal(),
                vol_freedom: policy.vol_freedom.to_option_decimal(),
                vol_alpha: policy.vol_alpha.to_option_decimal(),
                vol_beta: policy.vol_beta.to_option_decimal(),
                target_mean: policy.target_mean.to_decimal(),
                vol_mu: policy.vol_mu.to_decimal(),
                vol_input_mode: policy.vol_input_mode.unwrap_or_default(),
                vol_fatness_level: policy.vol_fatness_level,
                vol_skew_level: policy.vol_skew_level,
                vol_width_level: policy.vol_width_level,
                created_at: policy.created_at,
            });
        }

        phases_resp.push(RevenuePhaseResponse {
            id: phase.id,
            revenue_item_id: phase.revenue_item_id,
            phase_sequence: phase.phase_sequence.unwrap_or_zero(),
            trigger_month: phase.trigger_month.unwrap_or_zero(),
            growth_rate_percent: phase.growth_rate_percent.to_decimal(),
            cost_of_revenue_percent: phase.cost_of_revenue_percent.to_option_decimal(),
            created_at: phase.created_at,
            volatility_configs: policies_resp,
        });
    }

    tx.commit().await.map_err(|e| AppError::ValidationError(format!("Failed to commit transaction: {}", e)))?;

    Ok(Json(RevenueItemTreeResponse {
        id: item.id,
        plan_id: item.plan_id,
        revenue_name: item.revenue_name,
        source: item.source,
        start_month: item.start_month.unwrap_or_zero(),
        end_month: item.end_month,
        initial_amount: item.initial_amount.to_decimal(),
        frequency: item.frequency,
        created_at: item.created_at,
        phases: phases_resp,
    }))
}

pub async fn delete_revenue_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result: sqlx::postgres::PgQueryResult = sqlx::query!(
        "DELETE FROM revenue_items WHERE id = $1 AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)", 
        id,
        claims.tenant_id
    )
        .execute(&pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Item not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
</file>

<file path="backend/src/handlers/expenses.rs">
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use crate::models::Claims;
use crate::errors::AppError;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use std::str::FromStr;

trait UnwrapOrZero {
    fn unwrap_or_zero(self) -> i32;
}
impl UnwrapOrZero for i32 {
    fn unwrap_or_zero(self) -> i32 { self }
}
impl UnwrapOrZero for Option<i32> {
    fn unwrap_or_zero(self) -> i32 { self.unwrap_or(0) }
}

trait ToDecimal {
    fn to_decimal(&self) -> Decimal;
}
impl ToDecimal for String {
    fn to_decimal(&self) -> Decimal { Decimal::from_str(self).unwrap_or(Decimal::ZERO) }
}
impl ToDecimal for Option<String> {
    fn to_decimal(&self) -> Decimal { self.as_deref().and_then(|s| Decimal::from_str(s).ok()).unwrap_or(Decimal::ZERO) }
}
impl ToDecimal for Decimal {
    fn to_decimal(&self) -> Decimal { *self }
}
impl ToDecimal for Option<Decimal> {
    fn to_decimal(&self) -> Decimal { self.unwrap_or(Decimal::ZERO) }
}

trait ToOptionDecimal {
    fn to_option_decimal(&self) -> Option<Decimal>;
}
impl ToOptionDecimal for String {
    fn to_option_decimal(&self) -> Option<Decimal> { Decimal::from_str(self).ok() }
}
impl ToOptionDecimal for Option<String> {
    fn to_option_decimal(&self) -> Option<Decimal> { self.as_deref().and_then(|s| Decimal::from_str(s).ok()) }
}
impl ToOptionDecimal for Decimal {
    fn to_option_decimal(&self) -> Option<Decimal> { Some(*self) }
}
impl ToOptionDecimal for Option<Decimal> {
    fn to_option_decimal(&self) -> Option<Decimal> { *self }
}

#[derive(Deserialize)]
pub struct VolatilityConfigInput {
    pub mode_name: String,
    pub volatility_type: String,
    pub vol_min: Option<String>,
    pub vol_max: Option<String>,
    pub vol_intervals: Option<i32>,
    pub target_mean: String,
    pub vol_scale: Option<String>,
    pub vol_freedom: Option<String>,
    pub vol_alpha: Option<String>,
    pub vol_beta: Option<String>,
    pub vol_input_mode: String,
    pub vol_fatness_level: Option<String>,
    pub vol_skew_level: Option<String>,
    pub vol_width_level: Option<String>,
}

#[derive(Deserialize)]
pub struct ExpensePhaseInput {
    pub phase_sequence: i32,
    pub trigger_month: i32,
    pub growth_rate_percent: String,
    pub pct_of_revenue: Option<String>,
    pub volatility_configs: Vec<VolatilityConfigInput>,
}

#[derive(Deserialize)]
pub struct CreateExpenseRequest {
    pub plan_id: Uuid,
    pub expense_name: String,
    pub category: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: String,
    pub frequency: String,
    pub phases: Vec<ExpensePhaseInput>,
}

#[derive(Deserialize)]
pub struct UpdateExpenseRequest {
    pub expense_name: String,
    pub category: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: String,
    pub frequency: String,
    pub phases: Vec<ExpensePhaseInput>,
}

#[derive(Serialize)]
pub struct ExpensePolicyResponse {
    pub id: Uuid,
    pub phase_id: Uuid,
    pub mode_name: String,
    pub volatility_type: String,
    pub vol_min: Option<Decimal>,
    pub vol_max: Option<Decimal>,
    pub vol_intervals: Option<i32>,
    pub vol_mean: Option<Decimal>,
    pub vol_scale: Option<Decimal>,
    pub vol_freedom: Option<Decimal>,
    pub vol_alpha: Option<Decimal>,
    pub vol_beta: Option<Decimal>,
    pub target_mean: Decimal,
    pub vol_mu: Decimal,
    pub vol_input_mode: String,
    pub vol_fatness_level: Option<String>,
    pub vol_skew_level: Option<String>,
    pub vol_width_level: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize)]
pub struct ExpensePhaseResponse {
    pub id: Uuid,
    pub expense_item_id: Uuid,
    pub phase_sequence: i32,
    pub trigger_month: i32,
    pub growth_rate_percent: Decimal,
    pub pct_of_revenue: Option<Decimal>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub volatility_configs: Vec<ExpensePolicyResponse>,
}

#[derive(Serialize)]
pub struct ExpenseItemTreeResponse {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub expense_name: String,
    pub category: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: Decimal,
    pub frequency: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub phases: Vec<ExpensePhaseResponse>,
}

// Helper to calculate NRIG parameters
fn calculate_nrig_params(
    mode: &str,
    fatness: Option<&str>,
    skew: Option<&str>,
    width: Option<&str>,
    target_mean: Decimal,
    inp_alpha: Option<Decimal>,
    inp_beta: Option<Decimal>,
    inp_scale: Option<Decimal>,
) -> Result<(Option<Decimal>, Option<Decimal>, Option<Decimal>, Decimal), AppError> {
    let target_mean_f = target_mean.to_f64().unwrap_or(0.0);

    if mode == "simple" {
        // 1. Alpha (Fatness)
        let alpha_f: f64 = match fatness.unwrap_or("heavy") {
            "skinny" => 100.0,
            "normal" => 50.0,
            "moderate" => 2.0,
            "heavy" => 0.5,
            unrecognized => {
                eprintln!("ERROR: Unrecognized fatness option: {}. Defaulting alpha to 50.0 (normal).", unrecognized);
                50.0
            }
        };

        // 2. Beta (Skew)
        let skew_factor: f64 = match skew.unwrap_or("symmetric") {
            "strong_downside" => -0.9,
            "medium_downside" => -0.4,
            "symmetric" => 0.0,
            "medium_upside" => 0.4,
            "strong_upside" => 0.9,
            unrecognized => {
                eprintln!("ERROR: Unrecognized skew option: {}. Defaulting skew to 0.0 (symmetric).", unrecognized);
                0.0
            }
        };
        let beta_f: f64 = alpha_f * skew_factor;

        // 3. Scale/Delta (Width)
        let sigma: f64 = match width.unwrap_or("medium") {
            "very_low" => 1.0,
            "low" => 3.2,
            "medium" => 10.0,
            "high" => 20.0,
            "very_high" => 32.0,
            unrecognized => {
                eprintln!("ERROR: Unrecognized width option: {}. Defaulting width to 10.0 (medium).", unrecognized);
                10.0
            }
        };
        
        // Delta = Sigma^2 * Alpha * (1 - Factor^2)^1.5
        let term = (1.0 - skew_factor.powi(2)).powf(1.5);
        let delta_f = sigma.powi(2) * alpha_f * term;

        // 4. Mu
        // Mu = Target - Delta * (Beta / sqrt(Alpha^2 - Beta^2))
        let denom = (alpha_f.powi(2) - beta_f.powi(2)).sqrt();
        let drift = if denom > 0.0 {
            delta_f * (beta_f / denom)
        } else {
            0.0
        };
        let mu_f = target_mean_f - drift;

        Ok((
            Decimal::from_f64_retain(alpha_f),
            Decimal::from_f64_retain(beta_f),
            Decimal::from_f64_retain(delta_f),
            Decimal::from_f64_retain(mu_f).unwrap_or(target_mean),
        ))
    } else {
        // Advanced Mode
        let alpha = inp_alpha.ok_or_else(|| AppError::ValidationError("Alpha required for advanced NRIG".to_string()))?;
        let beta = inp_beta.ok_or_else(|| AppError::ValidationError("Beta required for advanced NRIG".to_string()))?;
        let scale = inp_scale.ok_or_else(|| AppError::ValidationError("Scale required for advanced NRIG".to_string()))?;

        let alpha_f = alpha.to_f64().unwrap_or(0.0);
        let beta_f = beta.to_f64().unwrap_or(0.0);
        let scale_f = scale.to_f64().unwrap_or(0.0);

        if alpha_f.abs() <= beta_f.abs() {
             return Err(AppError::ValidationError(format!(
                "NRIG Error: Alpha ({}) must be greater than absolute Beta ({})",
                alpha_f, beta_f.abs()
            )));
        }

        let denom = (alpha_f.powi(2) - beta_f.powi(2)).sqrt();
        let drift = if denom > 0.0 {
            scale_f * (beta_f / denom)
        } else {
            0.0
        };
        let mu_f = target_mean_f - drift;

        Ok((Some(alpha), Some(beta), Some(scale), Decimal::from_f64_retain(mu_f).unwrap_or(target_mean)))
    }
}

pub async fn create_expense_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateExpenseRequest>,
) -> Result<Json<ExpenseItemTreeResponse>, AppError> {
    if payload.phases.is_empty() {
        return Err(AppError::ValidationError("At least one phase must be provided.".to_string()));
    }

    // Length Validation
    if payload.expense_name.len() > 255 {
        return Err(AppError::ValidationError("Name exceeds 255 characters".to_string()));
    }
    if payload.category.len() > 255 {
        return Err(AppError::ValidationError("Category exceeds 255 characters".to_string()));
    }

    // Parse Decimals from Strings
    let initial_amount = Decimal::from_str(&payload.initial_amount)
        .map_err(|_| AppError::ValidationError("Invalid format for initial_amount".to_string()))?;
    
    if initial_amount < Decimal::ZERO {
        return Err(AppError::ValidationError("Initial amount must be non-negative".to_string()));
    }

    // Verify plan ownership
    let plan_exists: Option<_> = sqlx::query!(
        "SELECT id FROM financial_plans WHERE id = $1 AND tenant_id = $2",
        payload.plan_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    if plan_exists.is_none() {
        return Err(AppError::NotFound("Financial plan not found or access denied".to_string()));
    }

    let mut tx = pool.begin().await?;

    let item = sqlx::query!(
        r#"
        INSERT INTO expense_items (
            plan_id, expense_name, category, start_month, end_month, initial_amount, frequency
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING 
            id, plan_id, expense_name, category, 
            start_month, end_month, 
            initial_amount, frequency, 
            created_at
        "#,
        payload.plan_id, payload.expense_name, payload.category, payload.start_month, payload.end_month, 
        initial_amount, payload.frequency
    )
    .fetch_one(&mut *tx)
    .await?;

    let mut phases_resp = Vec::new();

    for phase_input in payload.phases {
        let growth_rate_percent = Decimal::from_str(&phase_input.growth_rate_percent)
            .map_err(|_| AppError::ValidationError("Invalid format for growth_rate_percent".to_string()))?;

        let pct_of_revenue = match &phase_input.pct_of_revenue {
            Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for pct_of_revenue".to_string()))?),
            None => None,
        };

        let growth_rate_percent_str = growth_rate_percent.to_string();
        let pct_of_revenue_str = pct_of_revenue.as_ref().map(|v| v.to_string());

        let phase = sqlx::query!(
            r#"
            INSERT INTO expense_item_phases (
                expense_item_id, phase_sequence, trigger_month, growth_rate_percent, pct_of_revenue
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id, expense_item_id, phase_sequence, trigger_month, growth_rate_percent, pct_of_revenue, created_at
            "#,
            item.id, phase_input.phase_sequence, phase_input.trigger_month, growth_rate_percent_str, pct_of_revenue_str
        )
        .fetch_one(&mut *tx)
        .await?;

        let mut policies_resp = Vec::new();

        for config in phase_input.volatility_configs {
            let vol_min = match &config.vol_min {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_min".to_string()))?),
                None => None,
            };

            let vol_max = match &config.vol_max {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_max".to_string()))?),
                None => None,
            };

            let target_mean = Decimal::from_str(&config.target_mean)
                .map_err(|_| AppError::ValidationError("Invalid format for target_mean".to_string()))?;

            let mut vol_scale = match &config.vol_scale {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_scale".to_string()))?),
                None => None,
            };

            let vol_freedom = match &config.vol_freedom {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_freedom".to_string()))?),
                None => None,
            };

            let mut vol_alpha = match &config.vol_alpha {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_alpha".to_string()))?),
                None => None,
            };

            let mut vol_beta = match &config.vol_beta {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_beta".to_string()))?),
                None => None,
            };

            let mut vol_mu = target_mean;

            let valid_vol_types = ["normal", "student_t", "nrig", "flat"];
            if !valid_vol_types.contains(&config.volatility_type.as_str()) {
                return Err(AppError::ValidationError(format!(
                    "Invalid volatility_type: '{}'. Must be one of: {:?}", 
                    config.volatility_type, valid_vol_types
                )));
            }

            if config.volatility_type == "nrig" {
                let (a, b, s, m) = calculate_nrig_params(
                    &config.vol_input_mode,
                    config.vol_fatness_level.as_deref(),
                    config.vol_skew_level.as_deref(),
                    config.vol_width_level.as_deref(),
                    target_mean,
                    vol_alpha,
                    vol_beta,
                    vol_scale
                )?;
                vol_alpha = a;
                vol_beta = b;
                vol_scale = s;
                vol_mu = m;
            }

            let policy = sqlx::query!(
                r#"
                INSERT INTO expense_item_volatility_policies (
                    expense_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                    target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                RETURNING id, expense_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                    target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level, created_at
                "#,
                phase.id, config.mode_name, config.volatility_type, vol_min, vol_max, config.vol_intervals,
                Some(vol_mu), vol_scale, vol_freedom, vol_alpha, vol_beta,
                target_mean, vol_mu, config.vol_input_mode, config.vol_fatness_level, config.vol_skew_level, config.vol_width_level
            )
            .fetch_one(&mut *tx)
            .await?;

            policies_resp.push(ExpensePolicyResponse {
                id: policy.id,
                phase_id: policy.expense_item_phase_id,
                mode_name: policy.mode_name,
                volatility_type: policy.volatility_type,
                vol_min: policy.vol_min.to_option_decimal(),
                vol_max: policy.vol_max.to_option_decimal(),
                vol_intervals: policy.vol_intervals,
                vol_mean: policy.vol_mean.to_option_decimal(),
                vol_scale: policy.vol_scale.to_option_decimal(),
                vol_freedom: policy.vol_freedom.to_option_decimal(),
                vol_alpha: policy.vol_alpha.to_option_decimal(),
                vol_beta: policy.vol_beta.to_option_decimal(),
                target_mean: policy.target_mean.to_decimal(),
                vol_mu: policy.vol_mu.to_decimal(),
                vol_input_mode: policy.vol_input_mode.unwrap_or_default(),
                vol_fatness_level: policy.vol_fatness_level,
                vol_skew_level: policy.vol_skew_level,
                vol_width_level: policy.vol_width_level,
                created_at: policy.created_at,
            });
        }

        phases_resp.push(ExpensePhaseResponse {
            id: phase.id,
            expense_item_id: phase.expense_item_id,
            phase_sequence: phase.phase_sequence.unwrap_or_zero(),
            trigger_month: phase.trigger_month.unwrap_or_zero(),
            growth_rate_percent: phase.growth_rate_percent.to_decimal(),
            pct_of_revenue: phase.pct_of_revenue.to_option_decimal(),
            created_at: phase.created_at,
            volatility_configs: policies_resp,
        });
    }

    tx.commit().await?;

    Ok(Json(ExpenseItemTreeResponse {
        id: item.id,
        plan_id: item.plan_id,
        expense_name: item.expense_name,
        category: item.category,
        start_month: item.start_month.unwrap_or_zero(),
        end_month: item.end_month,
        initial_amount: item.initial_amount.to_decimal(),
        frequency: item.frequency,
        created_at: item.created_at,
        phases: phases_resp,
    }))
}

pub async fn get_expense_items(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<Vec<ExpenseItemTreeResponse>>, AppError> {
    let items = sqlx::query!(
        r#"
        SELECT 
            id, plan_id, expense_name, category, 
            start_month, end_month, 
            initial_amount, frequency, 
            created_at
        FROM expense_items 
        WHERE plan_id = $1 
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        ORDER BY start_month ASC
        "#,
        plan_id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    let mut responses = Vec::new();

    if !items.is_empty() {
        let item_ids: Vec<Uuid> = items.iter().map(|i| i.id).collect();
        
        let phases = sqlx::query!(
            r#"
            SELECT 
                id, expense_item_id, phase_sequence, trigger_month, 
                growth_rate_percent, pct_of_revenue, created_at
            FROM expense_item_phases
            WHERE expense_item_id = ANY($1)
            ORDER BY phase_sequence ASC
            "#,
            &item_ids
        )
        .fetch_all(&pool)
        .await?;

        let phase_ids: Vec<Uuid> = phases.iter().map(|p| p.id).collect();

        let policies = sqlx::query!(
            r#"
            SELECT 
                id, expense_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level,
                created_at
            FROM expense_item_volatility_policies
            WHERE expense_item_phase_id = ANY($1)
            "#,
            &phase_ids
        )
        .fetch_all(&pool)
        .await?;

        for item in items {
            let mut item_phases = Vec::new();
            
            for phase in phases.iter().filter(|p| p.expense_item_id == item.id) {
                let phase_policies = policies.iter().filter(|pol| pol.expense_item_phase_id == phase.id).map(|pol| ExpensePolicyResponse {
                    id: pol.id,
                    phase_id: pol.expense_item_phase_id,
                    mode_name: pol.mode_name.clone(),
                    volatility_type: pol.volatility_type.clone(),
                    vol_min: pol.vol_min.to_option_decimal(),
                    vol_max: pol.vol_max.to_option_decimal(),
                    vol_intervals: pol.vol_intervals,
                    vol_mean: pol.vol_mean.to_option_decimal(),
                    vol_scale: pol.vol_scale.to_option_decimal(),
                    vol_freedom: pol.vol_freedom.to_option_decimal(),
                    vol_alpha: pol.vol_alpha.to_option_decimal(),
                    vol_beta: pol.vol_beta.to_option_decimal(),
                    target_mean: pol.target_mean.to_decimal(),
                    vol_mu: pol.vol_mu.to_decimal(),
                    vol_input_mode: pol.vol_input_mode.clone().unwrap_or_default(),
                    vol_fatness_level: pol.vol_fatness_level.clone(),
                    vol_skew_level: pol.vol_skew_level.clone(),
                    vol_width_level: pol.vol_width_level.clone(),
                    created_at: pol.created_at,
                }).collect();

                item_phases.push(ExpensePhaseResponse {
                    id: phase.id,
                    expense_item_id: phase.expense_item_id,
                    phase_sequence: phase.phase_sequence.unwrap_or_zero(),
                    trigger_month: phase.trigger_month.unwrap_or_zero(),
                    growth_rate_percent: phase.growth_rate_percent.to_decimal(),
                    pct_of_revenue: phase.pct_of_revenue.to_option_decimal(),
                    created_at: phase.created_at,
                    volatility_configs: phase_policies,
                });
            }

            responses.push(ExpenseItemTreeResponse {
                id: item.id,
                plan_id: item.plan_id,
                expense_name: item.expense_name.clone(),
                category: item.category.clone(),
                start_month: item.start_month.unwrap_or_zero(),
                end_month: item.end_month,
                initial_amount: item.initial_amount.to_decimal(),
                frequency: item.frequency.clone(),
                created_at: item.created_at,
                phases: item_phases,
            });
        }
    }

    Ok(Json(responses))
}

pub async fn update_expense_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateExpenseRequest>,
) -> Result<Json<ExpenseItemTreeResponse>, AppError> {
    if payload.phases.is_empty() {
        return Err(AppError::ValidationError("At least one phase must be provided.".to_string()));
    }

    // Length Validation
    if payload.expense_name.len() > 255 {
        return Err(AppError::ValidationError("Name exceeds 255 characters".to_string()));
    }
    if payload.category.len() > 255 {
        return Err(AppError::ValidationError("Category exceeds 255 characters".to_string()));
    }

    // Parse Decimals from Strings
    let initial_amount = Decimal::from_str(&payload.initial_amount)
        .map_err(|_| AppError::ValidationError("Invalid format for initial_amount".to_string()))?;
    
    if initial_amount < Decimal::ZERO {
        return Err(AppError::ValidationError("Initial amount must be non-negative".to_string()));
    }

    let mut tx = pool.begin().await?;

    let item = sqlx::query!(
        r#"
        UPDATE expense_items SET
            expense_name = $1, category = $2, start_month = $3, end_month = $4,
            initial_amount = $5, frequency = $6
        WHERE id = $7
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $8)
        RETURNING 
            id, plan_id, expense_name, category, 
            start_month, end_month, 
            initial_amount, frequency, 
            created_at
        "#,
        payload.expense_name, payload.category, payload.start_month, payload.end_month, 
        initial_amount, payload.frequency,
        id,
        claims.tenant_id
    )
    .fetch_one(&mut *tx)
    .await?;

    // Delete existing policies and phases
    sqlx::query!("DELETE FROM expense_item_volatility_policies WHERE expense_item_phase_id IN (SELECT id FROM expense_item_phases WHERE expense_item_id = $1)", id)
        .execute(&mut *tx).await?;
    sqlx::query!("DELETE FROM expense_item_phases WHERE expense_item_id = $1", id)
        .execute(&mut *tx).await?;

    let mut phases_resp = Vec::new();

    for phase_input in payload.phases {
        let growth_rate_percent = Decimal::from_str(&phase_input.growth_rate_percent)
            .map_err(|_| AppError::ValidationError("Invalid format for growth_rate_percent".to_string()))?;

        let pct_of_revenue = match &phase_input.pct_of_revenue {
            Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for pct_of_revenue".to_string()))?),
            None => None,
        };

        let growth_rate_percent_str = growth_rate_percent.to_string();
        let pct_of_revenue_str = pct_of_revenue.as_ref().map(|v| v.to_string());

        let phase = sqlx::query!(
            r#"
            INSERT INTO expense_item_phases (
                expense_item_id, phase_sequence, trigger_month, growth_rate_percent, pct_of_revenue
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id, expense_item_id, phase_sequence, trigger_month, growth_rate_percent, pct_of_revenue, created_at
            "#,
            item.id, phase_input.phase_sequence, phase_input.trigger_month, growth_rate_percent_str, pct_of_revenue_str
        )
        .fetch_one(&mut *tx)
        .await?;

        let mut policies_resp = Vec::new();

        for config in phase_input.volatility_configs {
            let vol_min = match &config.vol_min {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_min".to_string()))?),
                None => None,
            };

            let vol_max = match &config.vol_max {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_max".to_string()))?),
                None => None,
            };

            let target_mean = Decimal::from_str(&config.target_mean)
                .map_err(|_| AppError::ValidationError("Invalid format for target_mean".to_string()))?;

            let mut vol_scale = match &config.vol_scale {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_scale".to_string()))?),
                None => None,
            };

            let vol_freedom = match &config.vol_freedom {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_freedom".to_string()))?),
                None => None,
            };

            let mut vol_alpha = match &config.vol_alpha {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_alpha".to_string()))?),
                None => None,
            };

            let mut vol_beta = match &config.vol_beta {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_beta".to_string()))?),
                None => None,
            };

            let mut vol_mu = target_mean;

            let valid_vol_types = ["normal", "student_t", "nrig", "flat"];
            if !valid_vol_types.contains(&config.volatility_type.as_str()) {
                return Err(AppError::ValidationError(format!(
                    "Invalid volatility_type: '{}'. Must be one of: {:?}", 
                    config.volatility_type, valid_vol_types
                )));
            }

            if config.volatility_type == "nrig" {
                let (a, b, s, m) = calculate_nrig_params(
                    &config.vol_input_mode,
                    config.vol_fatness_level.as_deref(),
                    config.vol_skew_level.as_deref(),
                    config.vol_width_level.as_deref(),
                    target_mean,
                    vol_alpha,
                    vol_beta,
                    vol_scale
                )?;
                vol_alpha = a;
                vol_beta = b;
                vol_scale = s;
                vol_mu = m;
            }

            let policy = sqlx::query!(
                r#"
                INSERT INTO expense_item_volatility_policies (
                    expense_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                    target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                RETURNING id, expense_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                    target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level, created_at
                "#,
                phase.id, config.mode_name, config.volatility_type, vol_min, vol_max, config.vol_intervals,
                Some(vol_mu), vol_scale, vol_freedom, vol_alpha, vol_beta,
                target_mean, vol_mu, config.vol_input_mode, config.vol_fatness_level, config.vol_skew_level, config.vol_width_level
            )
            .fetch_one(&mut *tx)
            .await?;

            policies_resp.push(ExpensePolicyResponse {
                id: policy.id,
                phase_id: policy.expense_item_phase_id,
                mode_name: policy.mode_name,
                volatility_type: policy.volatility_type,
                vol_min: policy.vol_min.to_option_decimal(),
                vol_max: policy.vol_max.to_option_decimal(),
                vol_intervals: policy.vol_intervals,
                vol_mean: policy.vol_mean.to_option_decimal(),
                vol_scale: policy.vol_scale.to_option_decimal(),
                vol_freedom: policy.vol_freedom.to_option_decimal(),
                vol_alpha: policy.vol_alpha.to_option_decimal(),
                vol_beta: policy.vol_beta.to_option_decimal(),
                target_mean: policy.target_mean.to_decimal(),
                vol_mu: policy.vol_mu.to_decimal(),
                vol_input_mode: policy.vol_input_mode.unwrap_or_default(),
                vol_fatness_level: policy.vol_fatness_level,
                vol_skew_level: policy.vol_skew_level,
                vol_width_level: policy.vol_width_level,
                created_at: policy.created_at,
            });
        }

        phases_resp.push(ExpensePhaseResponse {
            id: phase.id,
            expense_item_id: phase.expense_item_id,
            phase_sequence: phase.phase_sequence.unwrap_or_zero(),
            trigger_month: phase.trigger_month.unwrap_or_zero(),
            growth_rate_percent: phase.growth_rate_percent.to_decimal(),
            pct_of_revenue: phase.pct_of_revenue.to_option_decimal(),
            created_at: phase.created_at,
            volatility_configs: policies_resp,
        });
    }

    tx.commit().await?;

    Ok(Json(ExpenseItemTreeResponse {
        id: item.id,
        plan_id: item.plan_id,
        expense_name: item.expense_name,
        category: item.category,
        start_month: item.start_month.unwrap_or_zero(),
        end_month: item.end_month,
        initial_amount: item.initial_amount.to_decimal(),
        frequency: item.frequency,
        created_at: item.created_at,
        phases: phases_resp,
    }))
}

pub async fn delete_expense_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result: sqlx::postgres::PgQueryResult = sqlx::query!(
        "DELETE FROM expense_items WHERE id = $1 AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)",
        id,
        claims.tenant_id
    )
    .execute(&pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Item not found or access denied".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
</file>
```

