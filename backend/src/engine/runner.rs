use crate::models::{
    RevenueItem, ExpenseItem, StaffingRole, Event, CapitalInjection, 
    CreditFacility, DividendPolicy, ValuationAssumption, CapitalGrowthPolicy
};
use crate::projection::SimulationResult;
use crate::engine::domain::{self, SimState, ItemState, GrowthSampler};
use crate::engine::orchestrator::{FundOrchestrator, EnsembleMode};
use crate::distributions;
use uuid::Uuid;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;

/// Helper to convert database distribution parameters into the Engine's GrowthSampler.
fn create_sampler_from_db(
    vol_type: Option<&str>,
    mean: Option<Decimal>,
    scale: Option<Decimal>,
    min: Option<Decimal>,
    max: Option<Decimal>,
    intervals: Option<i32>,
    freedom: Option<Decimal>,
    alpha: Option<Decimal>,
    beta: Option<Decimal>,
) -> GrowthSampler {
    distributions::create_sampler(
        vol_type,
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

/// Generates a full Monte Carlo simulation for a single company entity.
/// Maps database models to the V4 Engine domain models and executes the orchestrator.
pub fn generate_simulation(
    company_id: Uuid,
    plan_name: String,
    currency_code: String,
    months: i32,
    initial_cash: Decimal,
    revenue_items: Vec<RevenueItem>,
    expense_items: Vec<ExpenseItem>,
    staffing_roles: Vec<StaffingRole>,
    events: Vec<Event>,
    capital_injections: Vec<CapitalInjection>,
    credit_facility: Option<CreditFacility>,
    dividend_policy: Option<DividendPolicy>,
    valuation_assumptions: Vec<ValuationAssumption>,
    capital_growth: Option<CapitalGrowthPolicy>,
    _use_monte_carlo: bool,
    stop_insolvency: bool,
    events_active: bool,
    pooling_fraction: Decimal,
    insolvency_threshold: Decimal,
    // New Soft Limit Parameters
    soft_limit_active: bool,
    soft_limit_threshold: Decimal,
    soft_limit_fraction: Decimal,
) -> SimulationResult {
    
    // 1. Map Revenue Items
    let engine_revenues: Vec<domain::Revenue> = revenue_items.iter().map(|r| {
        domain::Revenue {
            name: r.revenue_name.clone(),
            start_month: r.start_month,
            end_month: r.end_month,
            initial_amount: r.initial_amount.to_f64().unwrap_or(0.0),
            growth_rate: r.growth_rate_percent.to_f64().unwrap_or(0.0) / 100.0,
            frequency: r.frequency.clone(),
            cost_of_revenue: r.cost_of_revenue_percent.and_then(|d| d.to_f64()).unwrap_or(0.0) / 100.0,
        }
    }).collect();

    let revenue_states: Vec<ItemState> = revenue_items.iter().map(|r| {
        let sampler = create_sampler_from_db(
            r.volatility_type.as_deref(),
            r.vol_mean,
            r.vol_scale,
            r.vol_min,
            r.vol_max,
            r.vol_intervals,
            r.vol_freedom,
            r.vol_alpha,
            r.vol_beta,
        );
        
        ItemState {
            current_value: r.initial_amount.to_f64().unwrap_or(0.0),
            is_active: false,
            sampler,
        }
    }).collect();

    // 2. Map Expense Items
    let engine_expenses: Vec<domain::Expense> = expense_items.iter().map(|e| {
        domain::Expense {
            name: e.expense_name.clone(),
            category: e.category.clone(),
            start_month: e.start_month,
            end_month: e.end_month,
            initial_amount: e.initial_amount.to_f64().unwrap_or(0.0),
            growth_rate: e.growth_rate_percent.to_f64().unwrap_or(0.0) / 100.0,
            frequency: e.frequency.clone(),
            pct_of_revenue: e.pct_of_revenue.and_then(|d| d.to_f64()).map(|v| v / 100.0),
        }
    }).collect();

    let expense_states: Vec<ItemState> = expense_items.iter().map(|e| {
        let sampler = create_sampler_from_db(
            e.volatility_type.as_deref(),
            e.vol_mean,
            e.vol_scale,
            e.vol_min,
            e.vol_max,
            e.vol_intervals,
            e.vol_freedom,
            e.vol_alpha,
            e.vol_beta,
        );

        ItemState {
            current_value: e.initial_amount.to_f64().unwrap_or(0.0),
            is_active: false,
            sampler,
        }
    }).collect();

    // 3. Map Staffing Roles
    let engine_staffing: Vec<domain::Staffing> = staffing_roles.iter().map(|s| {
        domain::Staffing {
            name: s.role_name.clone(),
            annual_salary: s.annual_salary.to_f64().unwrap_or(0.0),
            start_month: s.start_month,
            target_count: s.target_count,
            hiring_plan: s.hiring_plan.clone(),
            hiring_rate: s.hiring_rate,
            annual_increase: s.annual_increase_percent.to_f64().unwrap_or(0.0) / 100.0,
        }
    }).collect();

    // 4. Map Credit Facility
    let engine_credit = credit_facility.map(|c| {
        domain::CreditFacility {
            facility_limit: c.facility_limit.to_f64().unwrap_or(0.0),
            interest_rate: c.interest_rate.to_f64().unwrap_or(0.0) / 100.0,
            is_annual_rate: c.is_annual_rate,
        }
    });

    // 5. Map Capital Injections
    let engine_injections: Vec<domain::CapitalInjection> = capital_injections.iter().map(|c| {
        domain::CapitalInjection {
            name: c.injection_name.clone(),
            amount: c.amount.to_f64().unwrap_or(0.0),
            month: c.month,
        }
    }).collect();

    // 6. Map Events (Deterministic Shocks)
    let engine_events: Vec<domain::Shock> = events.iter().filter_map(|s| {
        // Destructure the Option fields from the Event
        if let (Some(month), Some(val), Some(itype)) = (s.start_month, s.impact_value, &s.impact_type) {
            Some(domain::Shock {
                name: s.event_name.clone(),
                month: month,
                impact_type: itype.clone(),
                impact_value: val.to_f64().unwrap_or(0.0),
                duration_months: s.duration_months,
                target_company_id: None, // Deterministic shocks apply to self
            })
        } else {
            None
        }
    }).collect();

    // 7. Map Dividend Policy
    let engine_dividend = dividend_policy.map(|p| {
        domain::DividendPolicy {
            is_enabled: p.is_enabled,
            safety_threshold: p.safety_threshold.to_f64().unwrap_or(0.0),
            payout_ratio: p.payout_ratio.to_f64().unwrap_or(0.0),
        }
    });

    // 8. Map Valuation Assumption (Take first)
    let engine_valuation = valuation_assumptions.first().map(|v| {
        domain::ValuationAssumption {
            name: v.valuation_name.clone(),
            method: v.method.clone(),
            multiplier: v.multiplier.to_f64().unwrap_or(0.0),
            date_applied: v.date_applied,
        }
    });

    // 9. Map Capital Growth Policy & Sampler
    let engine_cap_growth = capital_growth.as_ref().map(|p| {
        domain::CapitalGrowthPolicy {
            growth_rate: p.growth_rate_percent.to_f64().unwrap_or(0.0) / 100.0,
        }
    });

    let cap_growth_sampler = capital_growth.as_ref().map(|p| {
        create_sampler_from_db(
            p.volatility_type.as_deref(),
            p.vol_mean,
            p.vol_scale,
            p.vol_min,
            p.vol_max,
            p.vol_intervals,
            p.vol_freedom,
            p.vol_alpha,
            p.vol_beta,
        )
    });

    // 10. Construct Simulation State
    let sim_state = SimState {
        id: company_id,
        company_name: plan_name,
        currency: currency_code,
        pooling_fraction: pooling_fraction.to_f64().unwrap_or(0.0),
        current_cash: initial_cash.to_f64().unwrap_or(0.0),
        insolvency_threshold: insolvency_threshold.to_f64().unwrap_or(100.0),
        is_solvent: true,
        stop_on_insolvency: stop_insolvency,
        cum_external_cap: 0.0,
        cum_dividends: 0.0,
        cum_pool_received: 0.0,
        cap_growth_sampler,
        
        // Soft Limit (Friction Tax)
        soft_limit_active,
        soft_limit_threshold: soft_limit_threshold.to_f64().unwrap_or(0.0),
        soft_limit_fraction: soft_limit_fraction.to_f64().unwrap_or(0.0),

        revenues: engine_revenues,
        expenses: engine_expenses,
        staffing: engine_staffing,
        shocks: engine_events,
        injections: engine_injections,
        dividend_policy: engine_dividend,
        credit_facility: engine_credit,
        valuation: engine_valuation,
        capital_growth: engine_cap_growth,
        revenue_states,
        expense_states,
        history: Vec::new(),
    };

    // 11. Initialize Orchestrator (Ensemble Mode for Single Company Simulation)
    // Use 499 simulations to ensure an exact median exists (odd number).
    let num_simulations = 499;
    assert!(num_simulations % 2 != 0, "Number of simulations must be odd for exact percentiles.");

    let orchestrator = FundOrchestrator::<EnsembleMode>::new(
        num_simulations, 
        vec![sim_state], 
        months, 
        stop_insolvency,
        events_active,
        events, // Pass raw events for stochastic generation
        Some(pooling_fraction)
    );

    // 12. Execute Simulation
    orchestrator.run()
}
