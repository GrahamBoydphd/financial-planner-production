use axum::{
    extract::{Path, State, Extension, Query},
    Json,
    debug_handler,
};
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use std::str::FromStr;
use serde::Deserialize;
use std::collections::HashMap;
use crate::{
    models,
    engine::{
        domain::{self, SimState, GrowthSampler, ItemState},
        orchestrator::{FundOrchestrator, PortfolioMode},
    },
    projection::SimulationResult, // STRICT IMPORT: Use the projection struct
    errors::AppError,
    distributions,
};

#[derive(Deserialize)]
pub struct SimParams {
    pub fund_plan_id: Option<Uuid>,
    pub months: Option<i32>,
    pub stop_insolvency: Option<bool>,
    pub include_initial_capital: Option<bool>,
    pub fund_pooling_fraction: Option<String>,
    pub ergodicity_correction: Option<String>, // NEW: Frontend slider override
    pub events_active: Option<bool>,
}

#[derive(Debug, Clone)]
pub struct VolatilityPolicyData {
    pub phase_id: Uuid,
    pub mode_name: String,
    pub volatility_type: Option<String>,
    pub vol_min: Option<Decimal>,
    pub vol_max: Option<Decimal>,
    pub vol_intervals: Option<i32>,
    pub vol_mean: Option<Decimal>,
    pub vol_scale: Option<Decimal>,
    pub vol_freedom: Option<Decimal>,
    pub vol_alpha: Option<Decimal>,
    pub vol_beta: Option<Decimal>,
}

#[derive(Debug, Clone)]
pub struct DbRevenueItem {
    pub id: Uuid,
    pub revenue_name: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: Decimal,
    pub frequency: String,
    pub trigger_strategy: String,
}

#[derive(Debug, Clone)]
pub struct DbRevenuePhase {
    pub id: Uuid,
    pub revenue_item_id: Uuid,
    pub phase_sequence: i32,
    pub trigger_month: Option<i32>,
    pub trigger_threshold: Option<String>,
    pub trigger_operator: Option<String>,
    pub growth_rate_percent: Option<String>,
    pub cost_of_revenue_percent: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DbExpenseItem {
    pub id: Uuid,
    pub expense_name: String,
    pub category: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: Decimal,
    pub frequency: String,
    pub trigger_strategy: String,
}

#[derive(Debug, Clone)]
pub struct DbExpensePhase {
    pub id: Uuid,
    pub expense_item_id: Uuid,
    pub phase_sequence: i32,
    pub trigger_month: Option<i32>,
    pub trigger_threshold: Option<String>,
    pub trigger_operator: Option<String>,
    pub growth_rate_percent: Option<String>,
    pub pct_of_revenue: Option<String>,
}

/// NEW: Plan-Centric Simulation Handler
/// Runs simulation directly from a Fund Plan ID
#[debug_handler]
pub async fn run_fund_plan_simulation(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<models::Claims>,
    Path(plan_id): Path<Uuid>,
    Query(params): Query<SimParams>,
) -> Result<Json<SimulationResult>, AppError> {
    // 1. Fetch Fund Plan
    let fund_plan = sqlx::query!(
        r#"
        SELECT fund_id, selected_plans, pooling_fraction
        FROM fund_plans
        WHERE id = $1 AND tenant_id = $2
        "#,
        plan_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Fund Plan not found: {}", plan_id)))?;

    let selected_plans_map: HashMap<String, Uuid> = serde_json::from_value(fund_plan.selected_plans)
        .unwrap_or_default();

    // Determine Pooling for Orchestrator (Slider Override > Plan Value)
    let pooling_for_orchestrator = if let Some(ref s) = params.ergodicity_correction {
        Some(Decimal::from_str(s).unwrap_or(Decimal::ZERO))
    } else {
        Some(fund_plan.pooling_fraction)
    };

    // Determine Pooling for SimState (Plan Value as default, unless legacy param overrides)
    let pooling_for_sim_state = if let Some(ref s) = params.fund_pooling_fraction {
        Decimal::from_str(s).unwrap_or(Decimal::ZERO) / Decimal::from(100)
    } else {
        fund_plan.pooling_fraction
    };

    internal_run_simulation(
        &pool,
        claims.tenant_id,
        fund_plan.fund_id,
        selected_plans_map,
        pooling_for_orchestrator,
        pooling_for_sim_state,
        params
    ).await
}

/// EXISTING: Fund-Centric Simulation Handler
/// Runs simulation from a Fund ID, optionally taking a plan_id in query params
#[debug_handler]
pub async fn run_fund_simulation(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<models::Claims>,
    Path(fund_id): Path<Uuid>,
    Query(params): Query<SimParams>,
) -> Result<Json<SimulationResult>, AppError> {
    // 1. Check Fund Exists
    let _fund = sqlx::query!(
        "SELECT id FROM funds WHERE id = $1 AND tenant_id = $2",
        fund_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Fund not found: {}", fund_id)))?;

    // 2. Handle Fund Plan Selection & Pooling Fraction
    let mut selected_plans_map: HashMap<String, Uuid> = HashMap::new();
    let mut fund_plan_pooling = Decimal::ZERO;

    if let Some(fp_id) = params.fund_plan_id {
        let record = sqlx::query!(
            r#"
            SELECT selected_plans, pooling_fraction
            FROM fund_plans
            WHERE id = $1 AND tenant_id = $2
            "#,
            fp_id,
            claims.tenant_id
        )
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Fund Plan not found: {}", fp_id)))?;

        if let Ok(map) = serde_json::from_value::<HashMap<String, Uuid>>(record.selected_plans) {
            selected_plans_map = map;
        }
        fund_plan_pooling = record.pooling_fraction;
    }

    // Determine Pooling for Orchestrator (Slider Override > Plan Value > 0)
    let pooling_for_orchestrator = if let Some(ref s) = params.ergodicity_correction {
        Some(Decimal::from_str(s).unwrap_or(Decimal::ZERO))
    } else {
        Some(fund_plan_pooling)
    };

    // Determine Pooling for SimState (Legacy Param > 0)
    let pooling_for_sim_state = if let Some(ref s) = params.fund_pooling_fraction {
        Decimal::from_str(s).unwrap_or(Decimal::ZERO) / Decimal::from(100)
    } else {
        Decimal::ZERO
    };

    internal_run_simulation(
        &pool,
        claims.tenant_id,
        fund_id,
        selected_plans_map,
        pooling_for_orchestrator,
        pooling_for_sim_state,
        params
    ).await
}

/// Shared Internal Simulation Logic
async fn internal_run_simulation(
    pool: &Pool<Postgres>,
    tenant_id: Uuid,
    fund_id: Uuid,
    selected_plans_map: HashMap<String, Uuid>,
    pooling_for_orchestrator: Option<Decimal>,
    pooling_for_sim_state: Decimal,
    params: SimParams,
) -> Result<Json<SimulationResult>, AppError> {
    
    // 1. Fetch Companies
    let companies = sqlx::query_as!(
        models::Company,
        r#"
        SELECT 
            id, fund_id, company_name, description, currency_code, created_at, 
            industry, business_model, technology, tenant_id
        FROM companies
        WHERE fund_id = $1 AND tenant_id = $2
        "#,
        fund_id,
        tenant_id
    )
    .fetch_all(pool)
    .await?;

    // Capture company IDs for event filtering later
    let company_ids: Vec<Uuid> = companies.iter().map(|c| c.id).collect();

    // Extract simulation parameters
    let stop_insolvency = params.stop_insolvency.unwrap_or(true);
    let include_init = params.include_initial_capital.unwrap_or(false);
    let events_active = params.events_active.unwrap_or(true);

    let mut sim_states: Vec<SimState> = Vec::new();
    let mut error_log: Vec<String> = Vec::new();

    // 2. Build SimState for each Company
    for company in companies {
        // Determine if we have a specific plan override
        let specific_plan_id = selected_plans_map.get(&company.id.to_string()).copied();

        let plan = if let Some(plan_id) = specific_plan_id {
            // Fetch specific plan
            sqlx::query_as!(
                models::FinancialPlan,
                r#"
                SELECT 
                    id, company_id, plan_name, description, start_month, currency_code, 
                    created_at, updated_at, initial_cash, pooling_fraction, tenant_id, last_p50_net_value,
                    insolvency_threshold,
                    soft_limit_active, soft_limit_threshold, soft_limit_fraction
                FROM financial_plans
                WHERE id = $1 AND tenant_id = $2
                "#,
                plan_id,
                tenant_id
            )
            .fetch_optional(pool)
            .await?
        } else {
            // Fetch latest plan (Default)
            sqlx::query_as!(
                models::FinancialPlan,
                r#"
                SELECT 
                    id, company_id, plan_name, description, start_month, currency_code, 
                    created_at, updated_at, initial_cash, pooling_fraction, tenant_id, last_p50_net_value,
                    insolvency_threshold,
                    soft_limit_active, soft_limit_threshold, soft_limit_fraction
                FROM financial_plans
                WHERE company_id = $1 AND tenant_id = $2
                ORDER BY created_at DESC
                LIMIT 1
                "#,
                company.id,
                tenant_id
            )
            .fetch_optional(pool)
            .await?
        };

        if let Some(plan) = plan {
            let state = fetch_and_map_company_state(
                pool, 
                plan, 
                company.company_name, 
                company.id, 
                stop_insolvency,
                include_init,
                pooling_for_sim_state,
                &mut error_log
            ).await?;
            sim_states.push(state);
        }
    }

    if !error_log.is_empty() {
        return Ok(Json(SimulationResult {
            errors: Some(error_log),
            ..Default::default()
        }));
    }

    if sim_states.is_empty() {
        return Err(AppError::ValidationError("No valid financial plans found for companies in this fund.".to_string()));
    }

    // 3. Run Simulation
    let months = params.months.unwrap_or(120).clamp(1, 1200);

    // Fetch Stochastic Events (Probabilistic events with no fixed start_month)
    let stochastic_events = sqlx::query_as!(
        models::Event,
        r#"
        SELECT 
            id as "id!", 
            plan_id, 
            fund_ids, 
            company_ids,
            event_name as "event_name!", 
            start_month, 
            event_category, 
            impact_type, 
            impact_value, 
            duration_months, 
            likelihood_annual_pct, 
            magnitude, 
            direction, 
            duration_category,
            is_counter_cyclic,
            created_at as "created_at!"
        FROM events
        WHERE ($1 = ANY(fund_ids) OR company_ids && $2)
          AND start_month IS NULL
        "#,
        fund_id,
        &company_ids
    )
    .fetch_all(pool)
    .await?;

    // Initialize FundOrchestrator with 499 iterations (Portfolio Mode for Fund Simulation)
    // Move ownership of heavy data into the blocking thread
    let result = tokio::task::spawn_blocking(move || {
        let orchestrator = FundOrchestrator::<PortfolioMode>::new(
            499, 
            sim_states, 
            months, 
            stop_insolvency, 
            events_active, 
            stochastic_events, 
            pooling_for_orchestrator
        );
        orchestrator.run()
    })
    .await
    .map_err(|e| AppError::InternalServerError(format!("Simulation task failed: {}", e)))?;

    Ok(Json(result))
}

/// Helper to fetch all related data for a plan and map it to the Engine's SimState.
async fn fetch_and_map_company_state(
    pool: &Pool<Postgres>,
    plan: models::FinancialPlan,
    company_name: String,
    company_id: Uuid,
    stop_insolvency: bool,
    include_init: bool,
    fund_pooling_rate: Decimal,
    error_log: &mut Vec<String>,
) -> Result<SimState, AppError> {
    
    // Fetch Revenue Items
    let revenue_items = sqlx::query_as!(
        DbRevenueItem,
        r#"
        SELECT 
            id, revenue_name, start_month, end_month, 
            initial_amount, frequency, trigger_strategy
        FROM revenue_items
        WHERE plan_id = $1
        "#,
        plan.id
    )
    .fetch_all(pool)
    .await?;

    // Fetch Revenue Phases
    let revenue_phases = sqlx::query_as!(
        DbRevenuePhase,
        r#"
        SELECT 
            p.id, p.revenue_item_id, p.phase_sequence, 
            p.trigger_month, p.trigger_threshold, p.trigger_operator, 
            p.growth_rate_percent, p.cost_of_revenue_percent
        FROM revenue_item_phases p
        JOIN revenue_items i ON i.id = p.revenue_item_id
        WHERE i.plan_id = $1
        ORDER BY p.phase_sequence ASC
        "#,
        plan.id
    )
    .fetch_all(pool)
    .await?;

    // Fetch Expense Items
    let expense_items = sqlx::query_as!(
        DbExpenseItem,
        r#"
        SELECT 
            id, expense_name, category, start_month, end_month, 
            initial_amount, frequency, trigger_strategy
        FROM expense_items
        WHERE plan_id = $1
        "#,
        plan.id
    )
    .fetch_all(pool)
    .await?;

    // Fetch Expense Phases
    let expense_phases = sqlx::query_as!(
        DbExpensePhase,
        r#"
        SELECT 
            p.id, p.expense_item_id, p.phase_sequence, 
            p.trigger_month, p.trigger_threshold, p.trigger_operator, 
            p.growth_rate_percent, p.pct_of_revenue
        FROM expense_item_phases p
        JOIN expense_items i ON i.id = p.expense_item_id
        WHERE i.plan_id = $1
        ORDER BY p.phase_sequence ASC
        "#,
        plan.id
    )
    .fetch_all(pool)
    .await?;

    // Fetch Revenue Policies
    let revenue_policies = sqlx::query!(
        r#"
        SELECT 
            p.id, p.revenue_item_phase_id as "phase_id!", p.mode_name, p.volatility_type, 
            p.vol_min, p.vol_max, p.vol_intervals, p.vol_mean, p.vol_scale, 
            p.vol_freedom, p.vol_alpha, p.vol_beta
        FROM revenue_item_volatility_policies p
        JOIN revenue_item_phases ph ON ph.id = p.revenue_item_phase_id
        JOIN revenue_items i ON i.id = ph.revenue_item_id
        WHERE i.plan_id = $1
        "#,
        plan.id
    )
    .fetch_all(pool)
    .await?;

    let rev_policies_data: Vec<VolatilityPolicyData> = revenue_policies.into_iter().map(|p| VolatilityPolicyData {
        phase_id: p.phase_id,
        mode_name: p.mode_name,
        volatility_type: Some(p.volatility_type),
        vol_min: p.vol_min,
        vol_max: p.vol_max,
        vol_intervals: p.vol_intervals,
        vol_mean: p.vol_mean,
        vol_scale: p.vol_scale,
        vol_freedom: p.vol_freedom,
        vol_alpha: p.vol_alpha,
        vol_beta: p.vol_beta,
    }).collect();

    // Fetch Expense Policies
    let expense_policies = sqlx::query!(
        r#"
        SELECT 
            p.id, p.expense_item_phase_id as "phase_id!", p.mode_name, p.volatility_type, 
            p.vol_min, p.vol_max, p.vol_intervals, p.vol_mean, p.vol_scale, 
            p.vol_freedom, p.vol_alpha, p.vol_beta
        FROM expense_item_volatility_policies p
        JOIN expense_item_phases ph ON ph.id = p.expense_item_phase_id
        JOIN expense_items i ON i.id = ph.expense_item_id
        WHERE i.plan_id = $1
        "#,
        plan.id
    )
    .fetch_all(pool)
    .await?;

    let exp_policies_data: Vec<VolatilityPolicyData> = expense_policies.into_iter().map(|p| VolatilityPolicyData {
        phase_id: p.phase_id,
        mode_name: p.mode_name,
        volatility_type: Some(p.volatility_type),
        vol_min: p.vol_min,
        vol_max: p.vol_max,
        vol_intervals: p.vol_intervals,
        vol_mean: p.vol_mean,
        vol_scale: p.vol_scale,
        vol_freedom: p.vol_freedom,
        vol_alpha: p.vol_alpha,
        vol_beta: p.vol_beta,
    }).collect();

    // Fetch Capital Injections
    let capital_injections = sqlx::query_as!(
        models::CapitalInjection,
        r#"
        SELECT id, plan_id, injection_name, amount, month, created_at
        FROM capital_injections
        WHERE plan_id = $1
        "#,
        plan.id
    )
    .fetch_all(pool)
    .await?;

    // Fetch Dividend Policy
    let dividend_policy = sqlx::query_as!(
        models::DividendPolicy,
        r#"
        SELECT id, plan_id, is_enabled, safety_threshold, payout_ratio, created_at, tracking_enabled as "tracking_enabled!"
        FROM dividend_policies
        WHERE plan_id = $1
        "#,
        plan.id
    )
    .fetch_optional(pool)
    .await?;

    // Fetch Credit Facility
    let credit_facility = sqlx::query_as!(
        models::CreditFacility,
        r#"
        SELECT id, plan_id, facility_limit, interest_rate, is_annual_rate, created_at
        FROM credit_facilities
        WHERE plan_id = $1
        "#,
        plan.id
    )
    .fetch_optional(pool)
    .await?;

    // Fetch Valuation Assumption
    let valuation_assumption = sqlx::query_as!(
        models::ValuationAssumption,
        r#"
        SELECT id, plan_id, valuation_name, method, multiplier, date_applied, created_at
        FROM valuation_assumptions
        WHERE plan_id = $1
        "#,
        plan.id
    )
    .fetch_optional(pool)
    .await?;

    // Fetch Events (Renamed from Shocks)
    // UPDATED: Fetch events linked to Plan OR Company OR Fund
    let events = sqlx::query_as!(
        models::Event,
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
        AND e.start_month IS NOT NULL
        "#,
        plan.id
    )
    .fetch_all(pool)
    .await?;

    // Fetch Staffing
    let staffing_roles = sqlx::query_as!(
        models::StaffingRole,
        r#"
        SELECT 
            id, plan_id, role_name, annual_salary, start_month, 
            target_count, hiring_plan, hiring_rate, annual_increase_percent, created_at
        FROM staffing_roles
        WHERE plan_id = $1
        "#,
        plan.id
    )
    .fetch_all(pool)
    .await?;

    // Fetch Capital Growth Policy
    let capital_growth_policy = sqlx::query_as!(
        models::CapitalGrowthPolicy,
        r#"
        SELECT 
            id, plan_id, volatility_type, vol_min, vol_max, vol_intervals, 
            vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta, 
            target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level,
            created_at, growth_rate_percent
        FROM capital_growth_policies
        WHERE plan_id = $1
        "#,
        plan.id
    )
    .fetch_optional(pool)
    .await?;

    // --- NRIG Validation & Policy Check ---
    for r in &revenue_items {
        let mut has_policy = false;
        let item_phase_ids: Vec<Uuid> = revenue_phases.iter().filter(|ph| ph.revenue_item_id == r.id).map(|ph| ph.id).collect();
        for p in &rev_policies_data {
            if item_phase_ids.contains(&p.phase_id) {
                has_policy = true;
                if let Some(vt) = &p.volatility_type {
                    if vt == "NRIG" {
                        let alpha = p.vol_alpha.unwrap_or(Decimal::ZERO);
                        let beta = p.vol_beta.unwrap_or(Decimal::ZERO);
                        if alpha * alpha <= beta * beta {
                            error_log.push(format!("Company '{}': Revenue '{}' has invalid NRIG parameters (alpha^2 <= beta^2).", company_name, r.revenue_name));
                        }
                    }
                }
            }
        }
        if !has_policy {
            error_log.push(format!("Stream item {} must have at least one volatility mode selected across its phases.", r.revenue_name));
        }
    }

    for e in &expense_items {
        let mut has_policy = false;
        let item_phase_ids: Vec<Uuid> = expense_phases.iter().filter(|ph| ph.expense_item_id == e.id).map(|ph| ph.id).collect();
        for p in &exp_policies_data {
            if item_phase_ids.contains(&p.phase_id) {
                has_policy = true;
                if let Some(vt) = &p.volatility_type {
                    if vt == "NRIG" {
                        let alpha = p.vol_alpha.unwrap_or(Decimal::ZERO);
                        let beta = p.vol_beta.unwrap_or(Decimal::ZERO);
                        if alpha * alpha <= beta * beta {
                            error_log.push(format!("Company '{}': Expense '{}' has invalid NRIG parameters (alpha^2 <= beta^2).", company_name, e.expense_name));
                        }
                    }
                }
            }
        }
        if !has_policy {
            error_log.push(format!("Stream item {} must have at least one volatility mode selected across its phases.", e.expense_name));
        }
    }

    if let Some(g) = &capital_growth_policy {
        if let Some(vt) = &g.volatility_type {
            if vt == "NRIG" {
                let alpha = g.vol_alpha.unwrap_or(Decimal::ZERO);
                let beta = g.vol_beta.unwrap_or(Decimal::ZERO);
                if alpha * alpha <= beta * beta {
                    error_log.push(format!("Company '{}': Capital Growth Policy has invalid NRIG parameters (alpha^2 <= beta^2).", company_name));
                }
            }
        }
    }
    // -----------------------

    // Map to Engine State
    Ok(map_to_sim_state(
        company_id,
        plan,
        company_name,
        revenue_items,
        expense_items,
        revenue_phases,
        expense_phases,
        rev_policies_data,
        exp_policies_data,
        capital_injections,
        dividend_policy,
        credit_facility,
        valuation_assumption,
        events,
        staffing_roles,
        capital_growth_policy,
        stop_insolvency,
        include_init,
        fund_pooling_rate
    ))
}

/// Pure function to map DB models to Engine Domain models.
fn map_to_sim_state(
    company_id: Uuid,
    plan: models::FinancialPlan,
    company_name: String,
    revenue_items: Vec<DbRevenueItem>,
    expense_items: Vec<DbExpenseItem>,
    revenue_phases: Vec<DbRevenuePhase>,
    expense_phases: Vec<DbExpensePhase>,
    revenue_policies: Vec<VolatilityPolicyData>,
    expense_policies: Vec<VolatilityPolicyData>,
    capital_injections: Vec<models::CapitalInjection>,
    dividend_policy: Option<models::DividendPolicy>,
    credit_facility: Option<models::CreditFacility>,
    valuation_assumption: Option<models::ValuationAssumption>,
    events: Vec<models::Event>,
    staffing_roles: Vec<models::StaffingRole>,
    capital_growth_policy: Option<models::CapitalGrowthPolicy>,
    stop_insolvency: bool,
    include_init: bool,
    pooling_rate_override: Decimal,
) -> SimState {
    
    let mut revenue_states = Vec::with_capacity(revenue_items.len());
    let engine_revenues: Vec<domain::Revenue> = revenue_items.into_iter().map(|r| {
        let mut item_phases = Vec::new();
        for ph in revenue_phases.iter().filter(|p| p.revenue_item_id == r.id) {
            let mut compounding_growth_sampler = None;
            let mut transient_noise_sampler = None;

            for p in revenue_policies.iter().filter(|p| p.phase_id == ph.id) {
                let sampler = create_sampler_from_db(
                    p.volatility_type.clone(),
                    p.vol_mean,
                    p.vol_scale,
                    p.vol_min,
                    p.vol_max,
                    p.vol_intervals,
                    p.vol_freedom,
                    p.vol_alpha,
                    p.vol_beta
                );
                if p.mode_name == "compounding_growth" {
                    compounding_growth_sampler = Some(sampler);
                } else if p.mode_name == "transient_noise" {
                    transient_noise_sampler = Some(sampler);
                }
            }

            item_phases.push(domain::Phase {
                phase_sequence: ph.phase_sequence,
                trigger_month: ph.trigger_month,
                trigger_threshold: ph.trigger_threshold.as_ref().map(|s| s.parse::<Decimal>().unwrap_or_default().to_f64().unwrap_or(0.0)),
                trigger_operator: ph.trigger_operator.clone(),
                growth_rate: ph.growth_rate_percent.as_ref().map(|s| s.parse::<Decimal>().unwrap_or_default().to_f64().unwrap_or(0.0)).unwrap_or(0.0) / 100.0,
                variable_pct: ph.cost_of_revenue_percent.as_ref().map(|s| s.parse::<Decimal>().unwrap_or_default().to_f64().unwrap_or(0.0) / 100.0),
                compounding_growth_sampler,
                transient_noise_sampler,
            });
        }

        item_phases.sort_by_key(|p| p.phase_sequence);

        revenue_states.push(ItemState {
            current_value: r.initial_amount.to_f64().unwrap_or(0.0),
            is_active: false,
        });

        domain::Revenue {
            name: r.revenue_name,
            start_month: r.start_month,
            end_month: r.end_month,
            initial_amount: r.initial_amount.to_f64().unwrap_or(0.0),
            frequency: r.frequency,
            trigger_strategy: r.trigger_strategy,
            phases: item_phases,
        }
    }).collect();

    let mut expense_states = Vec::with_capacity(expense_items.len());
    let engine_expenses: Vec<domain::Expense> = expense_items.into_iter().map(|e| {
        let mut item_phases = Vec::new();
        for ph in expense_phases.iter().filter(|p| p.expense_item_id == e.id) {
            let mut compounding_growth_sampler = None;
            let mut transient_noise_sampler = None;

            for p in expense_policies.iter().filter(|p| p.phase_id == ph.id) {
                let sampler = create_sampler_from_db(
                    p.volatility_type.clone(),
                    p.vol_mean,
                    p.vol_scale,
                    p.vol_min,
                    p.vol_max,
                    p.vol_intervals,
                    p.vol_freedom,
                    p.vol_alpha,
                    p.vol_beta
                );
                if p.mode_name == "compounding_growth" {
                    compounding_growth_sampler = Some(sampler);
                } else if p.mode_name == "transient_noise" {
                    transient_noise_sampler = Some(sampler);
                }
            }

            item_phases.push(domain::Phase {
                phase_sequence: ph.phase_sequence,
                trigger_month: ph.trigger_month,
                trigger_threshold: ph.trigger_threshold.as_ref().map(|s| s.parse::<Decimal>().unwrap_or_default().to_f64().unwrap_or(0.0)),
                trigger_operator: ph.trigger_operator.clone(),
                growth_rate: ph.growth_rate_percent.as_ref().map(|s| s.parse::<Decimal>().unwrap_or_default().to_f64().unwrap_or(0.0)).unwrap_or(0.0) / 100.0,
                variable_pct: ph.pct_of_revenue.as_ref().map(|s| s.parse::<Decimal>().unwrap_or_default().to_f64().unwrap_or(0.0) / 100.0),
                compounding_growth_sampler,
                transient_noise_sampler,
            });
        }

        item_phases.sort_by_key(|p| p.phase_sequence);

        expense_states.push(ItemState {
            current_value: e.initial_amount.to_f64().unwrap_or(0.0),
            is_active: false,
        });

        domain::Expense {
            name: e.expense_name,
            category: e.category,
            start_month: e.start_month,
            end_month: e.end_month,
            initial_amount: e.initial_amount.to_f64().unwrap_or(0.0),
            frequency: e.frequency,
            trigger_strategy: e.trigger_strategy,
            phases: item_phases,
        }
    }).collect();

    let engine_injections: Vec<domain::CapitalInjection> = capital_injections.into_iter().map(|c| {
        domain::CapitalInjection {
            name: c.injection_name,
            amount: c.amount.to_f64().unwrap_or(0.0),
            month: c.month,
        }
    }).collect();

    let engine_dividend = dividend_policy.map(|d| domain::DividendPolicy {
        is_enabled: d.is_enabled,
        safety_threshold: d.safety_threshold.to_f64().unwrap_or(0.0),
        payout_ratio: d.payout_ratio.to_f64().unwrap_or(0.0),
    });

    let engine_credit = credit_facility.map(|c| domain::CreditFacility {
        facility_limit: c.facility_limit.to_f64().unwrap_or(0.0),
        interest_rate: c.interest_rate.to_f64().unwrap_or(0.0) / 100.0,
        is_annual_rate: c.is_annual_rate,
    });

    let engine_valuation = valuation_assumption.map(|v| domain::ValuationAssumption {
        name: v.valuation_name,
        method: v.method,
        multiplier: v.multiplier.to_f64().unwrap_or(0.0),
        date_applied: v.date_applied,
    });

    // Map Events to Shocks, filtering out incomplete definitions
    let engine_shocks: Vec<domain::Shock> = events.into_iter().filter_map(|s| {
        if let (Some(month), Some(imp_type), Some(imp_val)) = (s.start_month, s.impact_type, s.impact_value) {
            Some(domain::Shock {
                name: s.event_name,
                month: month,
                impact_type: imp_type,
                impact_value: imp_val.to_f64().unwrap_or(0.0),
                duration_months: s.duration_months,
                target_company_id: None, // Deterministic shocks apply to self
            })
        } else {
            None
        }
    }).collect();

    let engine_staffing: Vec<domain::Staffing> = staffing_roles.into_iter().map(|s| {
        domain::Staffing {
            name: s.role_name,
            annual_salary: s.annual_salary.to_f64().unwrap_or(0.0),
            start_month: s.start_month,
            target_count: s.target_count,
            hiring_plan: s.hiring_plan,
            hiring_rate: s.hiring_rate,
            annual_increase: s.annual_increase_percent.to_f64().unwrap_or(0.0) / 100.0,
        }
    }).collect();

    let mut cap_growth_sampler = None;
    let engine_growth = capital_growth_policy.map(|g| {
        cap_growth_sampler = Some(create_sampler_from_db(
            g.volatility_type,
            g.vol_mean,
            g.vol_scale,
            g.vol_min,
            g.vol_max,
            g.vol_intervals,
            g.vol_mean, // Note: Using mean as freedom placeholder if needed, but create_sampler handles it
            g.vol_alpha,
            g.vol_beta
        ));
        
        domain::CapitalGrowthPolicy {
            growth_rate: g.growth_rate_percent.to_f64().unwrap_or(0.0) / 100.0,
        }
    });

    let initial_cash = plan.initial_cash.to_f64().unwrap_or(0.0);
    let starting_investment = if include_init { initial_cash } else { 0.0 };

    SimState {
        id: company_id,
        company_name,
        currency: plan.currency_code,
        pooling_fraction: pooling_rate_override.to_f64().unwrap_or(0.0),
        current_cash: plan.initial_cash.to_f64().unwrap_or(0.0),
        insolvency_threshold: plan.insolvency_threshold.to_f64().unwrap_or(100.0),
        is_solvent: true,
        stop_on_insolvency: stop_insolvency,
        cum_external_cap: starting_investment,
        cum_dividends: 0.0,
        cum_pool_received: 0.0,
        cap_growth_sampler,
        
        soft_limit_active: plan.soft_limit_active,
        soft_limit_threshold: plan.soft_limit_threshold.to_f64().unwrap_or(10000000000.0),
        soft_limit_fraction: plan.soft_limit_fraction.to_f64().unwrap_or(0.70),

        revenues: engine_revenues,
        expenses: engine_expenses,
        injections: engine_injections,
        dividend_policy: engine_dividend,
        credit_facility: engine_credit,
        valuation: engine_valuation,
        shocks: engine_shocks,
        staffing: engine_staffing,
        capital_growth: engine_growth,
        
        revenue_states,
        expense_states,
        history: Vec::new(),
    }
}

// Helper to bridge DB Decimals to Engine GrowthSampler
fn create_sampler_from_db(
    vol_type: Option<String>,
    mean: Option<rust_decimal::Decimal>,
    scale: Option<rust_decimal::Decimal>,
    min: Option<rust_decimal::Decimal>,
    max: Option<rust_decimal::Decimal>,
    intervals: Option<i32>,
    freedom: Option<rust_decimal::Decimal>,
    alpha: Option<rust_decimal::Decimal>,
    beta: Option<rust_decimal::Decimal>,
) -> GrowthSampler {
    distributions::create_sampler(
        vol_type.as_deref(),
        mean.and_then(|d| d.to_f64()),
        scale.and_then(|d| d.to_f64()),
        min.and_then(|d| d.to_f64()),
        max.and_then(|d| d.to_f64()),
        intervals,
        freedom.and_then(|d| d.to_f64()),
        alpha.and_then(|d| d.to_f64()),
        beta.and_then(|d| d.to_f64()),
    )
}
