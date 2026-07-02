use crate::models::{
    StaffingRole, Event, CapitalInjection, 
    CreditFacility, DividendPolicy, ValuationAssumption, CapitalGrowthPolicy
};
use crate::handlers::fund_simulation::{
    DbRevenueItem, DbRevenuePhase, DbExpenseItem, DbExpensePhase, VolatilityPolicyData
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

/// Evaluates the active phase for a given stream item based on its strategy and current state.
pub fn evaluate_active_phase<'a>(
    trigger_strategy: &str,
    phases: &'a [domain::Phase],
    current_month: i32,
    previous_value: f64,
) -> Option<&'a domain::Phase> {
    let mut active_phase: Option<&'a domain::Phase> = None;
    for phase in phases {
        let is_active = match trigger_strategy {
            "time_based" => {
                if let Some(tm) = phase.trigger_month {
                    current_month >= tm
                } else {
                    false
                }
            },
            "value_based" => {
                if let (Some(thresh), Some(op)) = (phase.trigger_threshold, phase.trigger_operator.as_deref()) {
                    match op {
                        "greater_than" => previous_value > thresh,
                        "less_than" => previous_value < thresh,
                        _ => false,
                    }
                } else {
                    false
                }
            },
            _ => false,
        };
        if is_active {
            if let Some(current) = active_phase {
                if phase.phase_sequence > current.phase_sequence {
                    active_phase = Some(phase);
                }
            } else {
                active_phase = Some(phase);
            }
        }
    }
    active_phase
}

/// Executes the step projection for a stream item dynamically applying the active phase's parameters.
pub fn project_item_step(
    trigger_strategy: &str,
    current_month: i32,
    previous_value: f64,
    phases: &mut [domain::Phase],
) -> (f64, f64) {
    let mut active_idx: Option<usize> = None;
    for (i, phase) in phases.iter().enumerate() {
        let is_active = match trigger_strategy {
            "time_based" => {
                if let Some(tm) = phase.trigger_month {
                    current_month >= tm
                } else {
                    false
                }
            },
            "value_based" => {
                if let (Some(thresh), Some(op)) = (phase.trigger_threshold, phase.trigger_operator.as_deref()) {
                    match op {
                        "greater_than" => previous_value > thresh,
                        "less_than" => previous_value < thresh,
                        _ => false,
                    }
                } else {
                    false
                }
            },
            _ => false,
        };
        if is_active {
            if let Some(curr_idx) = active_idx {
                if phase.phase_sequence > phases[curr_idx].phase_sequence {
                    active_idx = Some(i);
                }
            } else {
                active_idx = Some(i);
            }
        }
    }
    
    if let Some(idx) = active_idx {
        let phase = &mut phases[idx];
        let mut step_growth = phase.growth_rate;
        if let Some(sampler) = &mut phase.compounding_growth_sampler {
            step_growth += sampler.sample() / 100.0;
        }
        
        let mut noise = 0.0;
        if let Some(sampler) = &mut phase.transient_noise_sampler {
            noise = sampler.sample() / 100.0;
        }
        
        let new_value = previous_value * (1.0 + step_growth);
        let final_value = new_value * (1.0 + noise);
        let cost = phase.variable_pct.unwrap_or(0.0);
        
        (final_value, cost)
    } else {
        (previous_value, 0.0)
    }
}

/// Generates a full Monte Carlo simulation for a single company entity.
/// Maps database models to the V4 Engine domain models and executes the orchestrator.
pub fn generate_simulation(
    company_id: Uuid,
    plan_name: String,
    currency_code: String,
    months: i32,
    initial_cash: Decimal,
    revenue_items: Vec<DbRevenueItem>,
    revenue_phases: Vec<DbRevenuePhase>,
    revenue_policies: Vec<VolatilityPolicyData>,
    expense_items: Vec<DbExpenseItem>,
    expense_phases: Vec<DbExpensePhase>,
    expense_policies: Vec<VolatilityPolicyData>,
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
        let mut item_phases = Vec::new();
        for ph in revenue_phases.iter().filter(|p| p.revenue_item_id == r.id) {
            let mut compounding_growth_sampler = None;
            let mut transient_noise_sampler = None;

            for p in revenue_policies.iter().filter(|p| p.phase_id == ph.id) {
                let sampler = create_sampler_from_db(
                    p.volatility_type.as_deref(),
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

        domain::Revenue {
            name: r.revenue_name.clone(),
            start_month: r.start_month,
            end_month: r.end_month,
            initial_amount: r.initial_amount.to_f64().unwrap_or(0.0),
            frequency: r.frequency.clone(),
            trigger_strategy: r.trigger_strategy.clone(),
            phases: item_phases,
        }
    }).collect();

    let revenue_states: Vec<ItemState> = revenue_items.iter().map(|r| {
        ItemState {
            current_value: r.initial_amount.to_f64().unwrap_or(0.0),
            is_active: false,
        }
    }).collect();

    // 2. Map Expense Items
    let engine_expenses: Vec<domain::Expense> = expense_items.iter().map(|e| {
        let mut item_phases = Vec::new();
        for ph in expense_phases.iter().filter(|p| p.expense_item_id == e.id) {
            let mut compounding_growth_sampler = None;
            let mut transient_noise_sampler = None;

            for p in expense_policies.iter().filter(|p| p.phase_id == ph.id) {
                let sampler = create_sampler_from_db(
                    p.volatility_type.as_deref(),
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

        domain::Expense {
            name: e.expense_name.clone(),
            category: e.category.clone(),
            start_month: e.start_month,
            end_month: e.end_month,
            initial_amount: e.initial_amount.to_f64().unwrap_or(0.0),
            frequency: e.frequency.clone(),
            trigger_strategy: e.trigger_strategy.clone(),
            phases: item_phases,
        }
    }).collect();

    let expense_states: Vec<ItemState> = expense_items.iter().map(|e| {
        ItemState {
            current_value: e.initial_amount.to_f64().unwrap_or(0.0),
            is_active: false,
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
