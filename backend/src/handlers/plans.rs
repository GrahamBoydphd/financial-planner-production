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
