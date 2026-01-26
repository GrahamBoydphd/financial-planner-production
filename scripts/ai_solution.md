🤖 Connecting to gemini-3-pro-preview (Paid Tier)...
<file path='backend/src/handlers/fund_simulation.rs'>
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
}

#[debug_handler]
pub async fn run_fund_simulation(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<models::Claims>,
    Path(fund_id): Path<Uuid>,
    Query(params): Query<SimParams>,
) -> Result<Json<SimulationResult>, AppError> {
    // 1. Fetch Fund
    let _fund = sqlx::query_as!(
        models::Fund,
        r#"
        SELECT 
            id, user_id, fund_name, currency_code, created_at, tenant_id, is_public_template
        FROM funds
        WHERE id = $1 AND tenant_id = $2
        "#,
        fund_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Fund not found: {}", fund_id)))?;

    // 2. Fetch Companies
    let companies = sqlx::query_as!(
        models::Company,
        r#"
        SELECT 
            id, fund_id, company_name, currency_code, created_at, 
            industry, business_model, technology, tenant_id
        FROM companies
        WHERE fund_id = $1 AND tenant_id = $2
        "#,
        fund_id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    // NEW: Handle Fund Plan Selection
    let mut selected_plans_map: HashMap<String, Uuid> = HashMap::new();

    if let Some(fp_id) = params.fund_plan_id {
        let record = sqlx::query!(
            r#"
            SELECT selected_plans
            FROM fund_plans
            WHERE id = $1 AND tenant_id = $2
            "#,
            fp_id,
            claims.tenant_id
        )
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Fund Plan not found: {}", fp_id)))?;

        let json_val = record.selected_plans;
        if let Ok(map) = serde_json::from_value::<HashMap<String, Uuid>>(json_val) {
            selected_plans_map = map;
        }
    }

    // Extract simulation parameters early to pass to SimState builder
    let stop_insolvency = params.stop_insolvency.unwrap_or(true);
    let include_init = params.include_initial_capital.unwrap_or(false);

    // Parse fund_pooling_fraction (Global Real Pooling Rate)
    // Standard: Input is percentage (e.g. "100.0"), Factor is input/100 (e.g. "1.0")
    let (_input_percent, real_pooling_rate) = if let Some(ref s) = params.fund_pooling_fraction {
        let val = Decimal::from_str(s).unwrap_or(Decimal::ZERO);
        (val, val / Decimal::from(100))
    } else {
        (Decimal::ZERO, Decimal::ZERO)
    };

    let mut sim_states: Vec<SimState> = Vec::new();

    // 3. Build SimState for each Company
    for company in companies {
        // Determine if we have a specific plan override
        let specific_plan_id = selected_plans_map.get(&company.id.to_string()).copied();

        let plan = if let Some(plan_id) = specific_plan_id {
            // Fetch specific plan
            sqlx::query_as!(
                models::FinancialPlan,
                r#"
                SELECT 
                    id, company_id, plan_name, start_month, currency_code, 
                    created_at, updated_at, initial_cash, pooling_fraction, tenant_id, last_p50_net_value,
                    insolvency_threshold
                FROM financial_plans
                WHERE id = $1 AND tenant_id = $2
                "#,
                plan_id,
                claims.tenant_id
            )
            .fetch_optional(&pool)
            .await?
        } else {
            // Fetch latest plan (Default)
            sqlx::query_as!(
                models::FinancialPlan,
                r#"
                SELECT 
                    id, company_id, plan_name, start_month, currency_code, 
                    created_at, updated_at, initial_cash, pooling_fraction, tenant_id, last_p50_net_value,
                    insolvency_threshold
                FROM financial_plans
                WHERE company_id = $1 AND tenant_id = $2
                ORDER BY created_at DESC
                LIMIT 1
                "#,
                company.id,
                claims.tenant_id
            )
            .fetch_optional(&pool)
            .await?
        };

        if let Some(plan) = plan {
            let state = fetch_and_map_company_state(
                &pool, 
                plan, 
                company.company_name, 
                company.id, 
                stop_insolvency,
                include_init,
                real_pooling_rate
            ).await?;
            sim_states.push(state);
        }
    }

    if sim_states.is_empty() {
        return Err(AppError::ValidationError("No valid financial plans found for companies in this fund.".to_string()));
    }

    // 4. Run Simulation
    let months = params.months.unwrap_or(60).clamp(1, 1200);
    // stop_insolvency is already defined above

    // Initialize FundOrchestrator with 1000 iterations (Portfolio Mode for Fund Simulation)
    let orchestrator = FundOrchestrator::<PortfolioMode>::new(1000, sim_states, months, stop_insolvency);
    let result = orchestrator.run();

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
) -> Result<SimState, AppError> {
    
    // Fetch Revenue
    let revenue_items = sqlx::query_as!(
        models::RevenueItem,
        r#"
        SELECT 
            id, plan_id, revenue_name, source, start_month, end_month, 
            initial_amount, growth_rate_percent, frequency, 
            cost_of_revenue_percent, volatility_type, 
            vol_min, vol_max, vol_intervals, vol_mean, vol_scale, 
            vol_freedom, vol_alpha, vol_beta, created_at
        FROM revenue_items
        WHERE plan_id = $1
        "#,
        plan.id
    )
    .fetch_all(pool)
    .await?;

    // Fetch Expenses
    let expense_items = sqlx::query_as!(
        models::ExpenseItem,
        r#"
        SELECT 
            id, plan_id, expense_name, category, start_month, end_month, 
            initial_amount, growth_rate_percent, frequency, 
            pct_of_revenue, volatility_type, 
            vol_min, vol_max, vol_intervals, vol_mean, vol_scale, 
            vol_freedom, vol_alpha, vol_beta, created_at
        FROM expense_items
        WHERE plan_id = $1
        "#,
        plan.id
    )
    .fetch_all(pool)
    .await?;

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

    // Fetch Event Shocks
    let event_shocks = sqlx::query_as!(
        models::EventShock,
        r#"
        SELECT id, plan_id, shock_name, shock_month, impact_type, impact_value, duration_months, created_at
        FROM event_shocks
        WHERE plan_id = $1
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
            created_at, growth_rate_percent
        FROM capital_growth_policies
        WHERE plan_id = $1
        "#,
        plan.id
    )
    .fetch_optional(pool)
    .await?;

    // Map to Engine State
    Ok(map_to_sim_state(
        company_id,
        plan,
        company_name,
        revenue_items,
        expense_items,
        capital_injections,
        dividend_policy,
        credit_facility,
        valuation_assumption,
        event_shocks,
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
    revenue_items: Vec<models::RevenueItem>,
    expense_items: Vec<models::ExpenseItem>,
    capital_injections: Vec<models::CapitalInjection>,
    dividend_policy: Option<models::DividendPolicy>,
    credit_facility: Option<models::CreditFacility>,
    valuation_assumption: Option<models::ValuationAssumption>,
    event_shocks: Vec<models::EventShock>,
    staffing_roles: Vec<models::StaffingRole>,
    capital_growth_policy: Option<models::CapitalGrowthPolicy>,
    stop_insolvency: bool,
    include_init: bool,
    pooling_rate_override: Decimal,
) -> SimState {
    
    let mut revenue_states = Vec::with_capacity(revenue_items.len());
    let engine_revenues: Vec<domain::Revenue> = revenue_items.into_iter().map(|r| {
        // Create sampler for this item
        let sampler = create_sampler_from_db(
            r.volatility_type,
            r.vol_mean,
            r.vol_scale,
            r.vol_min,
            r.vol_max,
            r.vol_intervals,
            r.vol_freedom,
            r.vol_alpha,
            r.vol_beta
        );
        
        // Initialize state with sampler
        revenue_states.push(ItemState {
            current_value: r.initial_amount.to_f64().unwrap_or(0.0),
            is_active: false,
            sampler,
        });

        domain::Revenue {
            name: r.revenue_name,
            start_month: r.start_month,
            end_month: r.end_month,
            initial_amount: r.initial_amount.to_f64().unwrap_or(0.0),
            growth_rate: r.growth_rate_percent.to_f64().unwrap_or(0.0) / 100.0,
            frequency: r.frequency,
            cost_of_revenue: r.cost_of_revenue_percent.map(|d| d.to_f64().unwrap_or(0.0) / 100.0).unwrap_or(0.0),
        }
    }).collect();

    let mut expense_states = Vec::with_capacity(expense_items.len());
    let engine_expenses: Vec<domain::Expense> = expense_items.into_iter().map(|e| {
        let sampler = create_sampler_from_db(
            e.volatility_type,
            e.vol_mean,
            e.vol_scale,
            e.vol_min,
            e.vol_max,
            e.vol_intervals,
            e.vol_freedom,
            e.vol_alpha,
            e.vol_beta
        );

        expense_states.push(ItemState {
            current_value: e.initial_amount.to_f64().unwrap_or(0.0),
            is_active: false,
            sampler,
        });

        domain::Expense {
            name: e.expense_name,
            category: e.category,
            start_month: e.start_month,
            end_month: e.end_month,
            initial_amount: e.initial_amount.to_f64().unwrap_or(0.0),
            growth_rate: e.growth_rate_percent.to_f64().unwrap_or(0.0) / 100.0,
            frequency: e.frequency,
            pct_of_revenue: e.pct_of_revenue.map(|d| d.to_f64().unwrap_or(0.0) / 100.0),
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

    let engine_shocks: Vec<domain::Shock> = event_shocks.into_iter().map(|s| {
        domain::Shock {
            name: s.shock_name,
            month: s.shock_month,
            impact_type: s.impact_type,
            impact_value: s.impact_value.to_f64().unwrap_or(0.0),
            duration_months: s.duration_months,
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
</file>

<file path='backend/src/engine/domain.rs'>
use uuid::Uuid;
use serde::{Serialize, Deserialize};
pub use crate::distributions::GrowthSampler;
use rust_decimal::Decimal;
use rust_decimal::prelude::{FromPrimitive, ToPrimitive};
use crate::projection::MonthlyData;

// --- STRUCTS (Preserved) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemState {
    pub current_value: f64,
    pub is_active: bool,
    pub sampler: GrowthSampler,
}

impl Default for ItemState {
    fn default() -> Self {
        Self { 
            current_value: 0.0, 
            is_active: false,
            sampler: GrowthSampler::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Revenue {
    pub name: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: f64,
    pub growth_rate: f64,
    pub frequency: String,
    pub cost_of_revenue: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Expense {
    pub name: String,
    pub category: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: f64,
    pub growth_rate: f64,
    pub frequency: String,
    pub pct_of_revenue: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Staffing {
    pub name: String,
    pub annual_salary: f64,
    pub start_month: i32,
    pub target_count: i32,
    pub hiring_plan: String,
    pub hiring_rate: Option<i32>,
    pub annual_increase: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Shock {
    pub name: String,
    pub month: i32,
    pub impact_type: String,
    pub impact_value: f64,
    pub duration_months: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapitalInjection {
    pub name: String,
    pub amount: f64,
    pub month: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DividendPolicy {
    pub is_enabled: bool,
    pub safety_threshold: f64,
    pub payout_ratio: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreditFacility {
    pub facility_limit: f64,
    pub interest_rate: f64,
    pub is_annual_rate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValuationAssumption {
    pub name: String,
    pub method: String,
    pub multiplier: f64,
    pub date_applied: Option<chrono::NaiveDate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapitalGrowthPolicy {
    pub growth_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Universe {
    pub companies: Vec<SimState>,
}

impl Universe {
    pub fn new(companies: Vec<SimState>) -> Self {
        Self { companies }
    }
}

fn default_true() -> bool { true }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimState {
    pub id: Uuid,
    pub company_name: String,
    pub currency: String,
    pub pooling_fraction: f64,
    pub current_cash: f64,
    pub insolvency_threshold: f64,
    pub is_solvent: bool,
    #[serde(default = "default_true")]
    pub stop_on_insolvency: bool,
    pub cum_external_cap: f64,
    pub cum_dividends: f64,
    pub cum_pool_received: f64,
    pub cap_growth_sampler: Option<GrowthSampler>,
    
    pub revenues: Vec<Revenue>,
    pub expenses: Vec<Expense>,
    pub staffing: Vec<Staffing>,
    pub shocks: Vec<Shock>,
    pub injections: Vec<CapitalInjection>,
    pub dividend_policy: Option<DividendPolicy>,
    pub credit_facility: Option<CreditFacility>,
    pub valuation: Option<ValuationAssumption>,
    pub capital_growth: Option<CapitalGrowthPolicy>,
    
    pub revenue_states: Vec<ItemState>,
    pub expense_states: Vec<ItemState>,
    
    pub history: Vec<MonthlyData>,
}

impl SimState {
    pub fn initialize(&mut self) {
        // 1. Process Month 0 Injections
        for injection in &self.injections {
            if injection.month == 0 {
                self.current_cash += injection.amount;
                self.cum_external_cap += injection.amount;
            }
        }

        // 2. Record Month 0 History
        self.history.push(MonthlyData {
            month_index: 0,
            date: "Month 0".to_string(),
            revenue: Decimal::ZERO,
            cogs: Decimal::ZERO,
            opex: Decimal::ZERO,
            gross_profit: Decimal::ZERO,
            net_income: Decimal::ZERO,
            cash_balance: Decimal::from_f64_retain(self.current_cash).unwrap_or_default(),
            is_solvent: true,
            interest_expense: Decimal::ZERO,
            dividend_paid: Decimal::ZERO,
            cumulative_dividends: Decimal::from_f64_retain(self.cum_dividends).unwrap_or_default(),
            cumulative_external_capital: Decimal::from_f64_retain(self.cum_external_cap).unwrap_or_default(),
            cumulative_pool_received: Decimal::from_f64_retain(self.cum_pool_received).unwrap_or_default(),
            total_value: Decimal::from_f64_retain(self.current_cash + self.cum_dividends).unwrap_or_default(),
            total_companies: 1,
            solvent_companies: 1,
        });
    }

    pub fn force_insolvency_state(&mut self) {
        self.is_solvent = false;
        self.current_cash = 0.0;
    }

    pub fn step(&mut self, month: i32) -> (f64, f64) {
        if !self.is_solvent {
            // Push "Erasure" (Zero) state
            self.history.push(MonthlyData {
                month_index: month,
                date: format!("Month {}", month),
                revenue: Decimal::ZERO,
                cogs: Decimal::ZERO,
                opex: Decimal::ZERO,
                gross_profit: Decimal::ZERO,
                net_income: Decimal::ZERO,
                cash_balance: Decimal::ZERO,
                is_solvent: false,
                interest_expense: Decimal::ZERO,
                dividend_paid: Decimal::ZERO,
                cumulative_dividends: Decimal::from_f64_retain(self.cum_dividends).unwrap_or_default(),
                cumulative_external_capital: Decimal::from_f64_retain(self.cum_external_cap).unwrap_or_default(),
                cumulative_pool_received: Decimal::from_f64_retain(self.cum_pool_received).unwrap_or_default(),
                total_value: Decimal::from_f64_retain(self.cum_dividends).unwrap_or_default(),
                total_companies: 1,
                solvent_companies: 0,
            });
            return (0.0, 0.0);
        }

        let mut monthly_rev = 0.0;
        let mut monthly_cogs = 0.0;
        let mut monthly_opex = 0.0;
        let monthly_interest = 0.0;

        // 1. Revenue
        for (i, item) in self.revenues.iter().enumerate() {
            let s = &mut self.revenue_states[i];
            
            if month == item.start_month {
                s.is_active = true;
                s.current_value = item.initial_amount;
            } else if let Some(end) = item.end_month {
                if month > end { s.is_active = false; }
            }

            if s.is_active {
                if item.frequency == "One-time" && month != item.start_month { continue; }
                
                // Logic: Base Growth + Volatility (Preserved)
                if month > item.start_month {
                    let rate = s.sampler.sample(); // Now returns f64 directly
                    // Formula: Value * (1 + (Base% + Volatility%)/100)
                    s.current_value *= 1.0 + (item.growth_rate * 100.0 + rate) / 100.0;
                }
                
                let item_rev = s.current_value;
                monthly_rev += item_rev;
                monthly_cogs += item_rev * item.cost_of_revenue;
            }
        }

        // 2. Expenses
        for (i, item) in self.expenses.iter().enumerate() {
            let s = &mut self.expense_states[i];
            
            if month == item.start_month {
                s.is_active = true;
                s.current_value = item.initial_amount;
            } else if let Some(end) = item.end_month {
                if month > end { s.is_active = false; }
            }

            if s.is_active {
                if item.frequency == "One-time" && month != item.start_month { continue; }
                
                if month > item.start_month {
                    let rate = s.sampler.sample();
                    s.current_value *= 1.0 + (item.growth_rate * 100.0 + rate) / 100.0;
                }
                
                let mut amt = s.current_value;
                if let Some(pct) = item.pct_of_revenue {
                    amt += monthly_rev * pct;
                }
                monthly_opex += amt;
            }
        }

        // 3. Staffing (Preserved Logic)
        for role in &self.staffing {
            if month >= role.start_month {
                let current_headcount = match role.hiring_plan.as_str() {
                    "monthly_rate" => {
                        let months_active = month - role.start_month;
                        let rate = role.hiring_rate.unwrap_or(1).max(1);
                        let hired = 1 + (months_active / rate);
                        hired.min(role.target_count)
                    }
                    _ => role.target_count,
                };

                if current_headcount > 0 {
                    let years_passed = (month - role.start_month) / 12;
                    let mut current_annual_salary = role.annual_salary;
                    if years_passed > 0 {
                        let multiplier = 1.0 + role.annual_increase;
                        for _ in 0..years_passed {
                            current_annual_salary *= multiplier;
                        }
                    }
                    let monthly_cost = (current_annual_salary * current_headcount as f64) / 12.0;
                    monthly_opex += monthly_cost;
                }
            }
        }

        // 4. Shocks
        for shock in &self.shocks {
            if month == shock.month {
                let mult = 1.0 + (shock.impact_value / 100.0);
                match shock.impact_type.as_str() {
                    "revenue" => { monthly_rev *= mult; monthly_cogs *= mult; },
                    "expense" | "opex" => monthly_opex *= mult,
                    "cogs" => monthly_cogs *= mult,
                    _ => {}
                }
            }
        }

        // 5. Injections
        for injection in &self.injections {
            if month == injection.month {
                self.current_cash += injection.amount;
                self.cum_external_cap += injection.amount;
            }
        }

        let gross_profit = monthly_rev - monthly_cogs;
        let total_expenses = monthly_opex + monthly_interest;
        let operating_profit = gross_profit - total_expenses;

        // 6. Update Cash
        self.current_cash += operating_profit;

        // 7. Investment Gain (Treasury)
        let mut investment_gain = 0.0;
        if self.current_cash > 0.0 {
            if let Some(policy) = &self.capital_growth {
                if let Some(sampler) = &mut self.cap_growth_sampler {
                    let rate = sampler.sample();
                    let effective_rate = (policy.growth_rate * 100.0 + rate) / 100.0;
                    investment_gain = self.current_cash * effective_rate;
                }
            }
        }
        self.current_cash += investment_gain;

        // 8. Pooling Contribution
        let total_profit = operating_profit + investment_gain;
        let mut contribution = 0.0;
        
        if self.pooling_fraction > 0.0 && total_profit > 0.0 {
            contribution = total_profit * self.pooling_fraction;
            // Deduct pool contribution immediately
            self.current_cash -= contribution;
        }

        let net_income = total_profit;


        // Record History
        self.history.push(MonthlyData {
            month_index: month,
            date: format!("Month {}", month),
            revenue: Decimal::from_f64_retain(monthly_rev).unwrap_or_default(),
            cogs: Decimal::from_f64_retain(monthly_cogs).unwrap_or_default(),
            opex: Decimal::from_f64_retain(monthly_opex).unwrap_or_default(),
            gross_profit: Decimal::from_f64_retain(gross_profit).unwrap_or_default(),
            net_income: Decimal::from_f64_retain(net_income).unwrap_or_default(),
            cash_balance: Decimal::from_f64_retain(self.current_cash).unwrap_or_default(),
            is_solvent: self.is_solvent,
            interest_expense: Decimal::from_f64_retain(monthly_interest).unwrap_or_default(),
            dividend_paid: Decimal::ZERO,
            cumulative_dividends: Decimal::from_f64_retain(self.cum_dividends).unwrap_or_default(),
            cumulative_external_capital: Decimal::from_f64_retain(self.cum_external_cap).unwrap_or_default(),
            cumulative_pool_received: Decimal::from_f64_retain(self.cum_pool_received).unwrap_or_default(),
            total_value: Decimal::from_f64_retain(self.current_cash + self.cum_dividends).unwrap_or_default(),
            total_companies: 1,
            solvent_companies: if self.is_solvent { 1 } else { 0 },
        });

        (net_income, contribution)
    }
}
</file>

<file path='backend/src/engine/orchestrator.rs'>
use crate::engine::domain::{Universe, SimState};
use crate::projection::{SimulationResult, MonthlyData};
use crate::distributions::VolatilityModel;
use rust_decimal::Decimal;
use rust_decimal::prelude::{FromPrimitive, ToPrimitive};
use std::cmp::Ordering;
use std::marker::PhantomData;

pub trait SimulationMode {}
pub struct PortfolioMode;
impl SimulationMode for PortfolioMode {}
pub struct EnsembleMode;
impl SimulationMode for EnsembleMode {}

pub struct FundOrchestrator<Mode: SimulationMode> {
    pub universes: Vec<Universe>,
    pub deterministic_universe: Universe,
    pub months: i32,
    _marker: PhantomData<Mode>,
}

impl<Mode: SimulationMode> FundOrchestrator<Mode> {
    pub fn new(iterations: usize, initial_states: Vec<SimState>, months: i32, stop_insolvency: bool) -> Self {
        // println!("🚀 Orchestrator Initializing: {} iterations, {} months, stop_insolvency={}", iterations, months, stop_insolvency);
        
        // 1. Create Monte Carlo Universes
        let mut universes = Vec::with_capacity(iterations);
        for _ in 0..iterations {
            universes.push(Universe::new(initial_states.clone()));
        }

        // Apply stop_insolvency to MC universes AND Initialize Month 0
        for u in universes.iter_mut() {
            for c in u.companies.iter_mut() {
                c.stop_on_insolvency = stop_insolvency;
                c.initialize();
            }
        }

        // 2. Create Deterministic Universe (No Volatility)
        let mut det_states = initial_states.clone();
        for state in det_states.iter_mut() {
            // Sanitize Revenue
            for item in state.revenue_states.iter_mut() {
                let mean = item.sampler.mean();
                item.sampler.set_model(VolatilityModel::None { fixed_rate: mean });
            }
            // Sanitize Expenses
            for item in state.expense_states.iter_mut() {
                let mean = item.sampler.mean();
                item.sampler.set_model(VolatilityModel::None { fixed_rate: mean });
            }
            // Sanitize Capital Growth Policy
            if let Some(sampler) = &mut state.cap_growth_sampler {
                let mean = sampler.mean();
                sampler.set_model(VolatilityModel::None { fixed_rate: mean });
            }
        }
        
        let mut deterministic_universe = Universe::new(det_states);
        
        // Apply stop_insolvency to Deterministic universe AND Initialize Month 0
        for c in deterministic_universe.companies.iter_mut() {
            c.stop_on_insolvency = stop_insolvency;
            c.initialize();
        }

        Self { 
            universes, 
            deterministic_universe, 
            months,
            _marker: PhantomData 
        }
    }

    /// Steps a universe forward by one month.
    /// Returns the total "pool pot" collected from this universe (if any).
    /// 
    /// - `enable_horizontal_pooling`: If true, distributes the pot within the universe immediately.
    /// - `apply_reaper`: If true, checks for insolvency and marks companies as dead if cash < 0.
    fn step_universe(universe: &mut Universe, month_idx: i32, enable_horizontal_pooling: bool, apply_reaper: bool) -> f64 {
        let mut pool_pot = 0.0;
        let mut solvent_count = 0;

        // TICK: Step all companies and collect pool contributions
        for company in universe.companies.iter_mut() {
            let (_, actual_contribution) = company.step(month_idx);

            if company.is_solvent {
                solvent_count += 1;
                pool_pot += actual_contribution;
            }
        }

        // TOCK: Distribute pool to solvent companies (Horizontal Pooling)
        if enable_horizontal_pooling {
            if solvent_count > 0 && pool_pot > 0.0 {
                let share = pool_pot / solvent_count as f64;

                for company in universe.companies.iter_mut() {
                    if company.is_solvent {
                        // Update Company State
                        company.current_cash += share;
                        company.cum_pool_received += share;

                        // Update History
                        if let Some(last_entry) = company.history.last_mut() {
                            last_entry.cash_balance = Decimal::from_f64_retain(company.current_cash).unwrap_or_default();
                            last_entry.cumulative_pool_received = Decimal::from_f64_retain(company.cum_pool_received).unwrap_or_default();
                            last_entry.total_value = last_entry.cash_balance + last_entry.cumulative_dividends;
                        }
                    }
                }
            }
            // Pot is consumed locally
            pool_pot = 0.0; 
        }

        // REAPER: Check for insolvency after all cash movements
        if apply_reaper {
            Self::run_reaper(universe);
        }

        // Return the pot (only non-zero if enable_horizontal_pooling is false)
        pool_pot
    }

    fn run_reaper(universe: &mut Universe) {
        for company in universe.companies.iter_mut() {
            if company.stop_on_insolvency && company.current_cash < company.insolvency_threshold {
                company.is_solvent = false;
                if let Some(last) = company.history.last_mut() {
                    last.is_solvent = false;
                }
            }
        }
    }

    fn aggregate_universe_history(universe: &Universe, months: i32) -> Vec<MonthlyData> {
        let mut universe_history = Vec::with_capacity((months + 1) as usize);
        let total_fund_companies = universe.companies.len() as i32;
        
        for m in 0..=months {
            let month_idx = m as usize;
            
            // Accumulators
            let mut total_revenue = 0.0;
            let mut total_opex = 0.0;
            let mut total_net_income = 0.0;
            let mut total_cash = 0.0;
            let mut total_value = 0.0;
            let mut total_pool_received = 0.0;
            let mut sum_investment = 0.0;
            let mut solvent_companies = 0;

            for company in &universe.companies {
                // Safety: Ensure we don't panic if history is missing
                if let Some(data) = company.history.get(month_idx) {
                    total_revenue += data.revenue.to_f64().unwrap_or(0.0);
                    total_opex += data.opex.to_f64().unwrap_or(0.0);
                    total_net_income += data.net_income.to_f64().unwrap_or(0.0);
                    total_cash += data.cash_balance.to_f64().unwrap_or(0.0);
                    total_value += data.total_value.to_f64().unwrap_or(0.0);
                    total_pool_received += data.cumulative_pool_received.to_f64().unwrap_or(0.0);
                    sum_investment += data.cumulative_external_capital.to_f64().unwrap_or(0.0);
                    
                    if data.is_solvent {
                        solvent_companies += 1;
                    }
                }
            }

            // Construct MonthlyData for the Fund (Universe)
            universe_history.push(MonthlyData {
                month_index: m,
                date: format!("Month {}", m),
                revenue: Decimal::from_f64_retain(total_revenue).unwrap_or_default(),
                cogs: Decimal::ZERO, 
                gross_profit: Decimal::ZERO, 
                opex: Decimal::from_f64_retain(total_opex).unwrap_or_default(),
                interest_expense: Decimal::ZERO,
                net_income: Decimal::from_f64_retain(total_net_income).unwrap_or_default(),
                cash_balance: Decimal::from_f64_retain(total_cash).unwrap_or_default(),
                dividend_paid: Decimal::ZERO,
                cumulative_dividends: Decimal::ZERO,
                cumulative_external_capital: Decimal::from_f64_retain(sum_investment).unwrap_or_default(),
                cumulative_pool_received: Decimal::from_f64_retain(total_pool_received).unwrap_or_default(),
                total_value: Decimal::from_f64_retain(total_value).unwrap_or_default(),
                is_solvent: solvent_companies > 0,
                total_companies: total_fund_companies,
                solvent_companies: solvent_companies,
            });
        }
        universe_history
    }

    fn finalize_results(self, fund_trajectories: Vec<Vec<MonthlyData>>, deterministic_data: Vec<MonthlyData>) -> SimulationResult {
        let iterations = fund_trajectories.len();
        
        // Generate Labels
        let mut labels = Vec::new();
        for m in 0..=self.months {
            labels.push(format!("Month {}", m));
        }

        // Statistical Aggregation
        let cap = (self.months + 1) as usize;
        let mut p0_vec = Vec::with_capacity(cap);
        let mut p10_vec = Vec::with_capacity(cap);
        let mut p25_vec = Vec::with_capacity(cap);
        let mut p50_vec = Vec::with_capacity(cap);
        let mut p75_vec = Vec::with_capacity(cap);
        let mut p90_vec = Vec::with_capacity(cap);
        let mut p100_vec = Vec::with_capacity(cap);

        let mut p0_count = Vec::with_capacity(cap);
        let mut p10_count = Vec::with_capacity(cap);
        let mut p25_count = Vec::with_capacity(cap);
        let mut p50_count = Vec::with_capacity(cap);
        let mut p75_count = Vec::with_capacity(cap);
        let mut p90_count = Vec::with_capacity(cap);
        let mut p100_count = Vec::with_capacity(cap);

        let mut survival_vec = Vec::with_capacity(cap);
        let mut p50_data = Vec::with_capacity(cap);

        if !fund_trajectories.is_empty() {
            for m_idx in 0..cap {
                let mut snapshots: Vec<&MonthlyData> = Vec::with_capacity(iterations);
                let mut solvent_universes = 0;

                for run in &fund_trajectories {
                    if let Some(data) = run.get(m_idx) {
                        snapshots.push(data);
                        
                        if data.is_solvent {
                            solvent_universes += 1;
                        }
                    }
                }

                // Sort snapshots by Total Value (NAV)
                snapshots.sort_by(|a, b| a.total_value.cmp(&b.total_value));
                let len = snapshots.len();

                if len > 0 {
                    let get_snapshot = |idx: usize| -> &MonthlyData {
                        snapshots[idx]
                    };

                    let p0 = get_snapshot(0);
                    let p10 = get_snapshot((len as f64 * 0.10) as usize);
                    let p25 = get_snapshot((len as f64 * 0.25) as usize);
                    let p50 = get_snapshot((len as f64 * 0.50) as usize);
                    let p75 = get_snapshot((len as f64 * 0.75) as usize);
                    let p90 = get_snapshot((len as f64 * 0.90) as usize);
                    let p100 = get_snapshot(len - 1);

                    // Push Values
                    p0_vec.push(p0.total_value);
                    p10_vec.push(p10.total_value);
                    p25_vec.push(p25.total_value);
                    p50_vec.push(p50.total_value);
                    p75_vec.push(p75.total_value);
                    p90_vec.push(p90.total_value);
                    p100_vec.push(p100.total_value);

                    // Push Solvent Counts
                    p0_count.push(p0.solvent_companies);
                    p10_count.push(p10.solvent_companies);
                    p25_count.push(p25.solvent_companies);
                    p50_count.push(p50.solvent_companies);
                    p75_count.push(p75.solvent_companies);
                    p90_count.push(p90.solvent_companies);
                    p100_count.push(p100.solvent_companies);

                    // P50 Data (Full Snapshot)
                    p50_data.push(p50.clone());
                }

                let rate = if iterations > 0 {
                    solvent_universes as f64 / iterations as f64
                } else {
                    0.0
                };
                survival_vec.push(Decimal::from_f64_retain(rate).unwrap_or_default());
            }
        }

        // Calculate Single Run Data (Median Trajectory)
        let mut single_run_data = None;
        let mut single_run_value = None;

        if !fund_trajectories.is_empty() {
            // Sort indices based on the total_value of the last month
            let mut indices: Vec<usize> = (0..fund_trajectories.len()).collect();
            indices.sort_by(|&a, &b| {
                let val_a = fund_trajectories[a].last().map(|m| m.total_value).unwrap_or(Decimal::ZERO);
                let val_b = fund_trajectories[b].last().map(|m| m.total_value).unwrap_or(Decimal::ZERO);
                val_a.cmp(&val_b)
            });

            // Pick the median trajectory
            if !indices.is_empty() {
                let median_idx = indices[indices.len() / 2];
                let selected_run = &fund_trajectories[median_idx];

                single_run_data = Some(selected_run.clone());
                single_run_value = Some(selected_run.iter().map(|m| m.total_value).collect());
            }
        }

        SimulationResult {
            labels,
            valuation_method: "fund_nav".to_string(),
            deterministic_data,
            single_run_data,
            single_run_value,
            p0_value: Some(p0_vec),
            p10_value: Some(p10_vec),
            p25_value: Some(p25_vec),
            p50_value: Some(p50_vec),
            p75_value: Some(p75_vec),
            p90_value: Some(p90_vec),
            p100_value: Some(p100_vec),
            p0_solvent_count: p0_count,
            p10_solvent_count: p10_count,
            p25_solvent_count: p25_count,
            p50_solvent_count: p50_count,
            p75_solvent_count: p75_count,
            p90_solvent_count: p90_count,
            p100_solvent_count: p100_count,
            p50_pool_cumulative: None,
            p50_data: Some(p50_data),
            survival_rate: Some(survival_vec),
            deterministic_runway: None,
            deterministic_valuation: Decimal::ZERO,
            single_run_runway: None,
            single_run_valuation: None,
            p50_runway: None,
            p50_valuation: None,
            all_paths: Some(fund_trajectories),
        }
    }
}

impl FundOrchestrator<PortfolioMode> {
    pub fn run(mut self) -> SimulationResult {
        // println!("🏃 Orchestrator Running (Portfolio Mode) for {} months...", self.months);
        let iterations = self.universes.len();
        
        for month_idx in 1..=self.months {
            // if month_idx % 12 == 0 { println!("... processing month {}", month_idx); }

            // A. Step Monte Carlo Universes (Horizontal Pooling ON, Reaper ON)
            for universe in self.universes.iter_mut() {
                Self::step_universe(universe, month_idx, true, true);
            }

            // B. Step Deterministic Universe (Horizontal Pooling ON, Reaper ON)
            Self::step_universe(&mut self.deterministic_universe, month_idx, true, true);
        }

        // println!("✅ Simulation Loop Complete. Aggregating...");

        let deterministic_data = Self::aggregate_universe_history(&self.deterministic_universe, self.months);
        let mut fund_trajectories = Vec::with_capacity(iterations);
        for universe in self.universes.iter() {
            fund_trajectories.push(Self::aggregate_universe_history(universe, self.months));
        }

        self.finalize_results(fund_trajectories, deterministic_data)
    }
}

impl FundOrchestrator<EnsembleMode> {
    pub fn run(mut self) -> SimulationResult {
        // println!("🏃 Orchestrator Running (Ensemble Mode) for {} months...", self.months);
        let iterations = self.universes.len();
        
        for month_idx in 1..=self.months {
            // if month_idx % 12 == 0 { println!("... processing month {}", month_idx); }

            let mut total_pot = 0.0;
            let mut solvent_universes_indices = Vec::new();

            // A. Step Monte Carlo Universes (Horizontal Pooling OFF, Reaper OFF)
            for (i, universe) in self.universes.iter_mut().enumerate() {
                let pot = Self::step_universe(universe, month_idx, false, false);
                total_pot += pot;

                // Check if universe is "alive" (has at least one solvent company)
                if universe.companies.iter().any(|c| c.is_solvent) {
                    solvent_universes_indices.push(i);
                }
            }

            // B. Vertical Pooling Logic
            let solvent_count = solvent_universes_indices.len();
            if solvent_count > 0 && total_pot > 0.0 {
                let share = total_pot / solvent_count as f64;

                for idx in solvent_universes_indices {
                    let universe = &mut self.universes[idx];
                    
                    // Distribute share to this universe's solvent companies
                    let universe_solvent_companies = universe.companies.iter().filter(|c| c.is_solvent).count();
                    
                    if universe_solvent_companies > 0 {
                        let company_share = share / universe_solvent_companies as f64;
                        
                        for company in universe.companies.iter_mut() {
                            if company.is_solvent {
                                company.current_cash += company_share;
                                company.cum_pool_received += company_share;
                                
                                // Update History for this month
                                if let Some(last_entry) = company.history.last_mut() {
                                    last_entry.cash_balance = Decimal::from_f64_retain(company.current_cash).unwrap_or_default();
                                    last_entry.cumulative_pool_received = Decimal::from_f64_retain(company.cum_pool_received).unwrap_or_default();
                                    last_entry.total_value = last_entry.cash_balance + last_entry.cumulative_dividends;
                                }
                            }
                        }
                    }
                }
            }

            // C. Run Reaper (Delayed Death)
            for universe in self.universes.iter_mut() {
                Self::run_reaper(universe);
            }

            // D. Step Deterministic Universe (Standard Mode)
            Self::step_universe(&mut self.deterministic_universe, month_idx, true, true);
        }

        // println!("✅ Simulation Loop Complete. Aggregating...");

        let deterministic_data = Self::aggregate_universe_history(&self.deterministic_universe, self.months);
        let mut fund_trajectories = Vec::with_capacity(iterations);
        for universe in self.universes.iter() {
            fund_trajectories.push(Self::aggregate_universe_history(universe, self.months));
        }

        self.finalize_results(fund_trajectories, deterministic_data)
    }
}
</file>

