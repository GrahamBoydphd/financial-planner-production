use crate::models::{RevenueItem, ExpenseItem, EventShock, ValuationAssumption, CapitalInjection, DividendPolicy, CreditFacility, CapitalGrowthPolicy, StaffingRole};
use crate::distributions::{GrowthSampler, VolatilityModel};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{NaiveDate};
use uuid::Uuid;
use rust_decimal::prelude::ToPrimitive;
use std::cmp::Ordering;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonthlyData {
    pub month_index: i32,
    pub date: String,
    pub revenue: Decimal,
    pub cogs: Decimal,
    pub gross_profit: Decimal,
    pub opex: Decimal,
    pub interest_expense: Decimal,
    pub net_income: Decimal,
    pub cash_balance: Decimal,
    pub dividend_paid: Decimal,
    pub cumulative_dividends: Decimal,
    pub cumulative_external_capital: Decimal,
    pub cumulative_pool_received: Decimal, 
    pub total_value: Decimal,
    pub is_solvent: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SimulationResult {
    pub labels: Vec<String>,
    pub valuation_method: String,
    pub deterministic_data: Vec<MonthlyData>,
    pub single_run_data: Option<Vec<MonthlyData>>, 
    pub single_run_value: Option<Vec<Decimal>>,

    pub p0_value: Option<Vec<Decimal>>,
    pub p10_value: Option<Vec<Decimal>>, 
    pub p25_value: Option<Vec<Decimal>>, 
    pub p50_value: Option<Vec<Decimal>>, 
    pub p75_value: Option<Vec<Decimal>>, 
    pub p90_value: Option<Vec<Decimal>>, 
    pub p100_value: Option<Vec<Decimal>>, 

    pub p50_pool_cumulative: Option<Vec<Decimal>>, 
    pub p50_data: Option<Vec<MonthlyData>>, 

    pub survival_rate: Option<Vec<Decimal>>,

    pub deterministic_runway: Option<i32>,
    pub deterministic_valuation: Decimal,

    pub single_run_runway: Option<i32>,
    pub single_run_valuation: Option<Decimal>,

    pub p50_runway: Option<i32>,
    pub p50_valuation: Option<Decimal>,
}

struct ItemState {
    current_value: Decimal,
    sampler: GrowthSampler,
    is_active: bool,
}

// Helper struct for Breadth-First Simulation (Deterministic/Decimal)
struct TrajectoryState {
    current_cash: Decimal,
    cum_external_cap: Decimal,
    cum_dividends: Decimal,
    cum_pool_received: Decimal, 
    is_insolvent: bool,
    revenue_states: HashMap<Uuid, ItemState>,
    expense_states: HashMap<Uuid, ItemState>,
    cap_growth_sampler: Option<GrowthSampler>,
    history: Vec<MonthlyData>,
}

fn calculate_runway(cash: Decimal, last_month_net_income: Decimal, is_solvent: bool) -> Option<i32> {
    if !is_solvent { return Some(0); }
    if cash < dec!(0.0) { return Some(0); }
    if last_month_net_income >= dec!(0.0) { return None; }
    let burn = -last_month_net_income;
    if burn == dec!(0.0) { return None; }
    Some((cash / burn).floor().to_i32().unwrap_or(0))
}

// Helper to create samplers (avoids code duplication)
fn create_sampler(
    force_deterministic: bool,
    v_type: Option<&String>, 
    rate: Decimal, 
    min: Option<Decimal>, 
    max: Option<Decimal>, 
    intv: Option<i32>, 
    scale: Option<Decimal>, 
    free: Option<Decimal>,
    alpha: Option<Decimal>, 
    beta: Option<Decimal>
) -> GrowthSampler {
    let avg = rate.to_f64().unwrap_or(0.0);
    if force_deterministic {
        return GrowthSampler::new(VolatilityModel::None { fixed_rate: avg });
    }
    let model = match v_type.map(|s| s.as_str()) {
        Some("flat") => VolatilityModel::Flat {
            average: avg,
            min: min.unwrap_or(rate).to_f64().unwrap_or(0.0),
            max: max.unwrap_or(rate).to_f64().unwrap_or(0.0),
            intervals: intv.unwrap_or(1),
        },
        Some("student_t") => VolatilityModel::StudentsT {
            mean: avg,
            scale: scale.unwrap_or(dec!(0.0)).to_f64().unwrap_or(0.0),
            freedom: free.unwrap_or(dec!(5.0)).to_f64().unwrap_or(5.0),
        },
        Some("nrig") => VolatilityModel::NRIG {
            alpha: alpha.unwrap_or(dec!(1.0)).to_f64().unwrap_or(1.0),
            beta: beta.unwrap_or(dec!(0.0)).to_f64().unwrap_or(0.0),
            delta: scale.unwrap_or(dec!(1.0)).to_f64().unwrap_or(1.0),
            mu: avg, 
        },
        _ => VolatilityModel::None { fixed_rate: avg },
    };
    GrowthSampler::new(model)
}

// Depth-First Simulation (Legacy/Deterministic)
fn run_iteration(
    start_month: NaiveDate,
    months: i32,
    initial_cash: Decimal,
    revenue_items: &[RevenueItem],
    expense_items: &[ExpenseItem],
    event_shocks: &[EventShock],
    capital_injections: &[CapitalInjection],
    dividend_policy: &Option<DividendPolicy>,
    _credit_facility: &Option<CreditFacility>, // Ignored
    capital_growth_policy: &Option<CapitalGrowthPolicy>,
    staffing_roles: &[StaffingRole],
    force_deterministic: bool,
    stop_on_insolvency: bool,
) -> Vec<MonthlyData> {
    
    let mut history = Vec::with_capacity(months as usize);
    let mut current_cash = initial_cash; 
    let mut cum_external_cap = initial_cash; 
    let mut cum_dividends = dec!(0.0);
    let cumulative_pool_received = dec!(0.0); 

    // Insolvency State: "previously_insolvent" means we crashed in a prior month
    // and are now in the "Erasure" phase (all 0s).
    let mut previously_insolvent = false;

    let mut revenue_states: HashMap<Uuid, ItemState> = HashMap::new();
    let mut expense_states: HashMap<Uuid, ItemState> = HashMap::new();

    let mut cap_growth_sampler = if let Some(policy) = capital_growth_policy {
        Some(create_sampler(force_deterministic, policy.volatility_type.as_ref(), policy.growth_rate_percent, 
            policy.vol_min, policy.vol_max, policy.vol_intervals, policy.vol_scale, policy.vol_freedom, policy.vol_alpha, policy.vol_beta))
    } else {
        None
    };

    for item in revenue_items {
        revenue_states.insert(item.id, ItemState {
            current_value: item.initial_amount,
            is_active: false,
            sampler: create_sampler(force_deterministic, item.volatility_type.as_ref(), item.growth_rate_percent, 
                item.vol_min, item.vol_max, item.vol_intervals, item.vol_scale, item.vol_freedom, item.vol_alpha, item.vol_beta)
        });
    }
    for item in expense_items {
        expense_states.insert(item.id, ItemState {
            current_value: item.initial_amount,
            is_active: false,
            sampler: create_sampler(force_deterministic, item.volatility_type.as_ref(), item.growth_rate_percent, 
                item.vol_min, item.vol_max, item.vol_intervals, item.vol_scale, item.vol_freedom, item.vol_alpha, item.vol_beta)
        });
    }

    let mut shock_map: HashMap<i32, Vec<&EventShock>> = HashMap::new();
    for shock in event_shocks { shock_map.entry(shock.shock_month).or_default().push(shock); }

    let mut injection_map: HashMap<i32, Decimal> = HashMap::new();
    for cap in capital_injections { *injection_map.entry(cap.month).or_default() += cap.amount; }

    if let Some(pre_seed) = injection_map.get(&0) {
        current_cash += pre_seed;
        cum_external_cap += pre_seed;
    }

    for m in 1..=months {
        let current_date = start_month.checked_add_months(chrono::Months::new((m - 1) as u32)).unwrap_or(start_month);
        let date_str = current_date.format("%Y-%m-%d").to_string();

        // If we were already insolvent from a previous month, we are in Erasure mode (0s).
        if previously_insolvent {
            history.push(MonthlyData {
                month_index: m,
                date: date_str,
                revenue: dec!(0.0),
                cogs: dec!(0.0),
                gross_profit: dec!(0.0),
                opex: dec!(0.0),
                interest_expense: dec!(0.0),
                net_income: dec!(0.0),
                cash_balance: dec!(0.0),
                dividend_paid: dec!(0.0),
                cumulative_dividends: cum_dividends,
                cumulative_external_capital: cum_external_cap,
                cumulative_pool_received: cumulative_pool_received,
                total_value: dec!(0.0),
                is_solvent: false,
            });
            continue;
        }

        let mut monthly_rev = dec!(0.0);
        let mut monthly_cogs = dec!(0.0);
        let mut monthly_opex = dec!(0.0);
        let monthly_interest = dec!(0.0); 

        // Calculate Flows
        for item in revenue_items {
            let state = revenue_states.get_mut(&item.id).unwrap();
            if m == item.start_month { state.is_active = true; state.current_value = item.initial_amount; }
            else if let Some(end) = item.end_month { if m > end { state.is_active = false; } }

            if state.is_active {
                if item.frequency == "One-time" && m != item.start_month { continue; }
                if m > item.start_month {
                    let rate = state.sampler.sample();
                    state.current_value *= dec!(1.0) + rate / dec!(100.0);
                }
                let item_rev = state.current_value;
                monthly_rev += item_rev;
                if let Some(cogs_pct) = item.cost_of_revenue_percent {
                    monthly_cogs += item_rev * (cogs_pct / dec!(100.0));
                }
            }
        }

        for item in expense_items {
            let state = expense_states.get_mut(&item.id).unwrap();
            if m == item.start_month { state.is_active = true; state.current_value = item.initial_amount; }
            else if let Some(end) = item.end_month { if m > end { state.is_active = false; } }

            if state.is_active {
                if item.frequency == "One-time" && m != item.start_month { continue; }
                if m > item.start_month {
                    let rate = state.sampler.sample();
                    state.current_value *= dec!(1.0) + rate / dec!(100.0);
                }
                let mut amt = state.current_value;
                if let Some(pct) = item.pct_of_revenue { amt += monthly_rev * (pct / dec!(100.0)); }
                monthly_opex += amt;
            }
        }

        for role in staffing_roles {
            if m >= role.start_month {
                let current_headcount = match role.hiring_plan.as_str() {
                    "monthly_rate" => {
                        let months_active = m - role.start_month;
                        let rate = role.hiring_rate.unwrap_or(1).max(1);
                        let hired = 1 + (months_active / rate);
                        hired.min(role.target_count)
                    },
                    _ => role.target_count,
                };

                if current_headcount > 0 {
                    let years_passed = (m - role.start_month) / 12;
                    let mut current_annual_salary = role.annual_salary;
                    if years_passed > 0 {
                            let multiplier = dec!(1.0) + (role.annual_increase_percent / dec!(100.0));
                            for _ in 0..years_passed {
                                current_annual_salary *= multiplier;
                            }
                    }
                    let monthly_cost = (current_annual_salary * Decimal::from(current_headcount)) / dec!(12.0);
                    monthly_opex += monthly_cost;
                }
            }
        }

        if let Some(shocks) = shock_map.get(&m) {
            for shock in shocks {
                let mult = dec!(1.0) + (shock.impact_value / dec!(100.0));
                match shock.impact_type.as_str() {
                    "revenue" => { monthly_rev *= mult; monthly_cogs *= mult; },
                    "expense" | "opex" => monthly_opex *= mult,
                    "cogs" => monthly_cogs *= mult,
                    _ => {}
                }
            }
        }

        let gross_profit = monthly_rev - monthly_cogs;
        let total_expenses = monthly_opex + monthly_interest;
        let net_income = gross_profit - total_expenses;
        
        current_cash += net_income;

        // Injections
        if let Some(injection) = injection_map.get(&m) {
            current_cash += injection;
            cum_external_cap += injection;
        }

        let mut dividend_paid = dec!(0.0);
        if let Some(policy) = dividend_policy {
            if policy.is_enabled {
                let surplus = current_cash - policy.safety_threshold;
                if surplus > dec!(0.0) {
                    dividend_paid = surplus * (policy.payout_ratio / dec!(100.0));
                    current_cash -= dividend_paid;
                    cum_dividends += dividend_paid;
                }
            }
        }

        if current_cash > dec!(0.0) {
            if let Some(sampler) = &mut cap_growth_sampler {
                let growth_rate = sampler.sample(); 
                let multiplier = dec!(1.0) + (growth_rate / dec!(100.0));
                current_cash *= multiplier;
            }
        }

        // Check insolvency at end of month
        let is_currently_insolvent = stop_on_insolvency && current_cash < dec!(0.0);
        
        if is_currently_insolvent {
            previously_insolvent = true;
        }

        history.push(MonthlyData {
            month_index: m,
            date: date_str,
            revenue: monthly_rev,
            cogs: monthly_cogs,
            gross_profit: gross_profit,
            opex: monthly_opex,
            interest_expense: dec!(0.0),
            net_income: net_income,
            cash_balance: current_cash,
            dividend_paid: dividend_paid,
            cumulative_dividends: cum_dividends,
            cumulative_external_capital: cum_external_cap,
            cumulative_pool_received: cumulative_pool_received,
            total_value: current_cash + cum_dividends,
            is_solvent: !is_currently_insolvent,
        });
    }
    history
}

// --- Hybrid Performance Architecture (f64 Hot Path) ---

struct RevenueItemF64 {
    start_month: i32,
    end_month: Option<i32>,
    initial_amount: f64,
    frequency: String,
    cost_of_revenue_percent: Option<f64>,
}

struct ExpenseItemF64 {
    start_month: i32,
    end_month: Option<i32>,
    initial_amount: f64,
    frequency: String,
    pct_of_revenue: Option<f64>,
}

struct StaffingRoleF64 {
    start_month: i32,
    target_count: i32,
    hiring_plan: String,
    hiring_rate: Option<i32>,
    annual_salary: f64,
    annual_increase_percent: f64,
}

struct ShockF64 {
    impact_type: String,
    impact_value: f64,
}

struct ItemStateF64 {
    current_value: f64,
    is_active: bool,
    sampler: GrowthSampler,
}

struct MonthlyDataF64 {
    month_index: i32,
    revenue: f64,
    cogs: f64,
    gross_profit: f64,
    opex: f64,
    interest_expense: f64,
    net_income: f64,
    cash_balance: f64,
    dividend_paid: f64,
    cumulative_dividends: f64,
    cumulative_external_capital: f64,
    cumulative_pool_received: f64,
    total_value: f64,
    is_solvent: bool,
}

// Performance SimState (Replaces TrajectoryStateF64)
struct SimState {
    current_cash: f64,
    cum_external_cap: f64,
    cum_dividends: f64,
    cum_pool_received: f64,
    is_solvent: bool, // Sole state indicator
    revenue_states: Vec<ItemStateF64>,
    expense_states: Vec<ItemStateF64>,
    cap_growth_sampler: Option<GrowthSampler>,
    history: Vec<MonthlyDataF64>,
}

// Breadth-First Simulation (Monte Carlo with Pooling) - Optimized f64
fn run_monte_carlo_breadth_first(
    start_month: NaiveDate,
    months: i32,
    initial_cash: Decimal,
    revenue_items: &[RevenueItem],
    expense_items: &[ExpenseItem],
    event_shocks: &[EventShock],
    capital_injections: &[CapitalInjection],
    dividend_policy: &Option<DividendPolicy>,
    _credit_facility: &Option<CreditFacility>, // Ignored
    capital_growth_policy: &Option<CapitalGrowthPolicy>,
    staffing_roles: &[StaffingRole],
    stop_on_insolvency: bool,
    pooling_fraction: Decimal,
) -> Vec<Vec<MonthlyData>> {

    let iterations = 1000;
    
    // 1. Pre-process inputs to f64 (Hot Path Optimization)
    let initial_cash_f64 = initial_cash.to_f64().expect("Decimal overflow");
    let pooling_fraction_f64 = pooling_fraction.to_f64().expect("Decimal overflow");

    let rev_items_f64: Vec<RevenueItemF64> = revenue_items.iter().map(|item| RevenueItemF64 {
        start_month: item.start_month,
        end_month: item.end_month,
        initial_amount: item.initial_amount.to_f64().unwrap_or(0.0),
        frequency: item.frequency.clone(),
        cost_of_revenue_percent: item.cost_of_revenue_percent.map(|d| d.to_f64().unwrap_or(0.0)),
    }).collect();

    let exp_items_f64: Vec<ExpenseItemF64> = expense_items.iter().map(|item| ExpenseItemF64 {
        start_month: item.start_month,
        end_month: item.end_month,
        initial_amount: item.initial_amount.to_f64().unwrap_or(0.0),
        frequency: item.frequency.clone(),
        pct_of_revenue: item.pct_of_revenue.map(|d| d.to_f64().unwrap_or(0.0)),
    }).collect();

    let staffing_f64: Vec<StaffingRoleF64> = staffing_roles.iter().map(|role| StaffingRoleF64 {
        start_month: role.start_month,
        target_count: role.target_count,
        hiring_plan: role.hiring_plan.clone(),
        hiring_rate: role.hiring_rate,
        annual_salary: role.annual_salary.to_f64().unwrap_or(0.0),
        annual_increase_percent: role.annual_increase_percent.to_f64().unwrap_or(0.0),
    }).collect();

    let mut shock_map_f64: HashMap<i32, Vec<ShockF64>> = HashMap::new();
    for shock in event_shocks {
        shock_map_f64.entry(shock.shock_month).or_default().push(ShockF64 {
            impact_type: shock.impact_type.clone(),
            impact_value: shock.impact_value.to_f64().unwrap_or(0.0),
        });
    }

    let mut injection_map_f64: HashMap<i32, f64> = HashMap::new();
    for cap in capital_injections {
        *injection_map_f64.entry(cap.month).or_default() += cap.amount.to_f64().unwrap_or(0.0);
    }

    let dividend_policy_f64 = dividend_policy.as_ref().map(|p| (p.is_enabled, p.safety_threshold.to_f64().unwrap_or(0.0), p.payout_ratio.to_f64().unwrap_or(0.0)));

    // 2. Initialize SimState Trajectories
    let mut trajectories = Vec::with_capacity(iterations);

    for _ in 0..iterations {
        let mut current_cash = initial_cash_f64;
        let mut cum_external_cap = initial_cash_f64;
        
        if let Some(pre_seed) = injection_map_f64.get(&0) {
            current_cash += pre_seed;
            cum_external_cap += pre_seed;
        }

        // Create states with samplers
        let mut revenue_states = Vec::with_capacity(revenue_items.len());
        for item in revenue_items {
            revenue_states.push(ItemStateF64 {
                current_value: item.initial_amount.to_f64().unwrap_or(0.0),
                is_active: false,
                sampler: create_sampler(false, item.volatility_type.as_ref(), item.growth_rate_percent, 
                    item.vol_min, item.vol_max, item.vol_intervals, item.vol_scale, item.vol_freedom, item.vol_alpha, item.vol_beta)
            });
        }

        let mut expense_states = Vec::with_capacity(expense_items.len());
        for item in expense_items {
            expense_states.push(ItemStateF64 {
                current_value: item.initial_amount.to_f64().unwrap_or(0.0),
                is_active: false,
                sampler: create_sampler(false, item.volatility_type.as_ref(), item.growth_rate_percent, 
                    item.vol_min, item.vol_max, item.vol_intervals, item.vol_scale, item.vol_freedom, item.vol_alpha, item.vol_beta)
            });
        }

        let cap_growth_sampler = if let Some(policy) = capital_growth_policy {
            Some(create_sampler(false, policy.volatility_type.as_ref(), policy.growth_rate_percent, 
                policy.vol_min, policy.vol_max, policy.vol_intervals, policy.vol_scale, policy.vol_freedom, policy.vol_alpha, policy.vol_beta))
        } else {
            None
        };

        trajectories.push(SimState {
            current_cash,
            cum_external_cap,
            cum_dividends: 0.0,
            cum_pool_received: 0.0, 
            is_solvent: true, // Initialized as solvent
            revenue_states,
            expense_states,
            cap_growth_sampler,
            history: Vec::with_capacity(months as usize),
        });
    }

    // 3. Breadth-First Loop (f64)
    for m in 1..=months {
        let mut monthly_pool = 0.0;
        // Store intermediate results: (rev, cogs, gp, opex, op_profit, contribution, inv_gain)
        let mut trajectory_financials = Vec::with_capacity(iterations);

        // Phase 1: Calculate Financials & Pool Contribution
        for state in trajectories.iter_mut() {
            if !state.is_solvent {
                trajectory_financials.push((0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0));
                continue;
            }

            let mut monthly_rev = 0.0;
            let mut monthly_cogs = 0.0;
            let mut monthly_opex = 0.0;
            let monthly_interest = 0.0;

            // Revenue
            for (i, item) in rev_items_f64.iter().enumerate() {
                let s = &mut state.revenue_states[i];
                if m == item.start_month { s.is_active = true; s.current_value = item.initial_amount; }
                else if let Some(end) = item.end_month { if m > end { s.is_active = false; } }

                if s.is_active {
                    if item.frequency == "One-time" && m != item.start_month { continue; }
                    if m > item.start_month {
                        let rate = s.sampler.sample().to_f64().unwrap_or(0.0);
                        s.current_value *= 1.0 + rate / 100.0;
                    }
                    let item_rev = s.current_value;
                    monthly_rev += item_rev;
                    if let Some(cogs_pct) = item.cost_of_revenue_percent {
                        monthly_cogs += item_rev * (cogs_pct / 100.0);
                    }
                }
            }

            // Expenses
            for (i, item) in exp_items_f64.iter().enumerate() {
                let s = &mut state.expense_states[i];
                if m == item.start_month { s.is_active = true; s.current_value = item.initial_amount; }
                else if let Some(end) = item.end_month { if m > end { s.is_active = false; } }

                if s.is_active {
                    if item.frequency == "One-time" && m != item.start_month { continue; }
                    if m > item.start_month {
                        let rate = s.sampler.sample().to_f64().unwrap_or(0.0);
                        s.current_value *= 1.0 + rate / 100.0;
                    }
                    let mut amt = s.current_value;
                    if let Some(pct) = item.pct_of_revenue { amt += monthly_rev * (pct / 100.0); }
                    monthly_opex += amt;
                }
            }

            // Staffing
            for role in &staffing_f64 {
                if m >= role.start_month {
                    let current_headcount = match role.hiring_plan.as_str() {
                        "monthly_rate" => {
                            let months_active = m - role.start_month;
                            let rate = role.hiring_rate.unwrap_or(1).max(1);
                            let hired = 1 + (months_active / rate);
                            hired.min(role.target_count)
                        },
                        _ => role.target_count,
                    };

                    if current_headcount > 0 {
                        let years_passed = (m - role.start_month) / 12;
                        let mut current_annual_salary = role.annual_salary;
                        if years_passed > 0 {
                                let multiplier = 1.0 + (role.annual_increase_percent / 100.0);
                                for _ in 0..years_passed {
                                    current_annual_salary *= multiplier;
                                }
                        }
                        let monthly_cost = (current_annual_salary * current_headcount as f64) / 12.0;
                        monthly_opex += monthly_cost;
                    }
                }
            }

            // Shocks
            if let Some(shocks) = shock_map_f64.get(&m) {
                for shock in shocks {
                    let mult = 1.0 + (shock.impact_value / 100.0);
                    match shock.impact_type.as_str() {
                        "revenue" => { monthly_rev *= mult; monthly_cogs *= mult; },
                        "expense" | "opex" => monthly_opex *= mult,
                        "cogs" => monthly_cogs *= mult,
                        _ => {}
                    }
                }
            }

            let gross_profit = monthly_rev - monthly_cogs;
            let total_expenses = monthly_opex + monthly_interest;
            let operating_profit = gross_profit - total_expenses;

            // 1. Update Cash with Operating Flow
            state.current_cash += operating_profit;

            // 2. Calculate Investment Result (Treasury)
            let mut investment_gain = 0.0;
            if state.current_cash > 0.0 {
                if let Some(sampler) = &mut state.cap_growth_sampler {
                    let growth_rate = sampler.sample().to_f64().unwrap_or(0.0);
                    investment_gain = state.current_cash * (growth_rate / 100.0);
                }
            }
            // 3. Update Cash with Investment Flow
            state.current_cash += investment_gain;

            // 4. Pooling Logic
            let mut contribution = 0.0;
            if pooling_fraction_f64 > 0.0 {
                let op_gain = if operating_profit > 0.0 { operating_profit } else { 0.0 };
                let inv_gain = if investment_gain > 0.0 { investment_gain } else { 0.0 };
                let poolable_income = op_gain + inv_gain;
                
                contribution = poolable_income * pooling_fraction_f64;
                monthly_pool += contribution;
            }

            // 5. Subtract Pool Contribution
            state.current_cash -= contribution;

            trajectory_financials.push((monthly_rev, monthly_cogs, gross_profit, monthly_opex, operating_profit, contribution, investment_gain));
        }

        // Phase 2: Distribute Pool & Finalize
        let pool_share = if iterations > 0 { monthly_pool / iterations as f64 } else { 0.0 };

        for (i, state) in trajectories.iter_mut().enumerate() {
            if !state.is_solvent {
                state.history.push(MonthlyDataF64 {
                    month_index: m,
                    revenue: 0.0,
                    cogs: 0.0,
                    gross_profit: 0.0,
                    opex: 0.0,
                    interest_expense: 0.0,
                    net_income: 0.0,
                    cash_balance: 0.0,
                    dividend_paid: 0.0,
                    cumulative_dividends: state.cum_dividends,
                    cumulative_external_capital: state.cum_external_cap,
                    cumulative_pool_received: state.cum_pool_received, 
                    total_value: 0.0,
                    is_solvent: false,
                });
                continue;
            }

            let (rev, cogs, gp, opex, op_profit, contribution, inv_gain) = trajectory_financials[i];
            
            // 6. Receive Share
            let received_share = pool_share;
            state.current_cash += received_share;
            state.cum_pool_received += received_share; 
            
            // 7. Capital Injections
            if let Some(injection) = injection_map_f64.get(&m) {
                state.current_cash += injection;
                state.cum_external_cap += injection;
            }

            // 8. Dividends
            let mut dividend_paid = 0.0;
            if let Some((enabled, threshold, ratio)) = dividend_policy_f64 {
                if enabled {
                    let surplus = state.current_cash - threshold;
                    if surplus > 0.0 {
                        dividend_paid = surplus * (ratio / 100.0);
                        state.current_cash -= dividend_paid;
                        state.cum_dividends += dividend_paid;
                    }
                }
            }

            // Check insolvency
            let is_currently_insolvent = stop_on_insolvency && state.current_cash < 0.0;
            
            let adjusted_net_income = op_profit + inv_gain - contribution + received_share;

            state.history.push(MonthlyDataF64 {
                month_index: m,
                revenue: rev,
                cogs: cogs,
                gross_profit: gp,
                opex: opex,
                interest_expense: 0.0,
                net_income: adjusted_net_income, 
                cash_balance: state.current_cash,
                dividend_paid,
                cumulative_dividends: state.cum_dividends,
                cumulative_external_capital: state.cum_external_cap,
                cumulative_pool_received: state.cum_pool_received, 
                total_value: state.current_cash + state.cum_dividends,
                is_solvent: !is_currently_insolvent,
            });

            if is_currently_insolvent {
                state.is_solvent = false;
            }
        }
    }

    // 4. Convert back to Decimal (The Fortress Standard)
    trajectories.into_iter().map(|t| {
        t.history.into_iter().map(|h| {
            let date_str = start_month.checked_add_months(chrono::Months::new((h.month_index - 1) as u32))
                .unwrap_or(start_month)
                .format("%Y-%m-%d")
                .to_string();

            MonthlyData {
                month_index: h.month_index,
                date: date_str,
                revenue: Decimal::from_f64_retain(h.revenue).unwrap_or_default(),
                cogs: Decimal::from_f64_retain(h.cogs).unwrap_or_default(),
                gross_profit: Decimal::from_f64_retain(h.gross_profit).unwrap_or_default(),
                opex: Decimal::from_f64_retain(h.opex).unwrap_or_default(),
                interest_expense: Decimal::from_f64_retain(h.interest_expense).unwrap_or_default(),
                net_income: Decimal::from_f64_retain(h.net_income).unwrap_or_default(),
                cash_balance: Decimal::from_f64_retain(h.cash_balance).unwrap_or_default(),
                dividend_paid: Decimal::from_f64_retain(h.dividend_paid).unwrap_or_default(),
                cumulative_dividends: Decimal::from_f64_retain(h.cumulative_dividends).unwrap_or_default(),
                cumulative_external_capital: Decimal::from_f64_retain(h.cumulative_external_capital).unwrap_or_default(),
                cumulative_pool_received: Decimal::from_f64_retain(h.cumulative_pool_received).unwrap_or_default(),
                total_value: Decimal::from_f64_retain(h.total_value).unwrap_or_default(),
                is_solvent: h.is_solvent,
            }
        }).collect()
    }).collect()
}

pub fn generate_simulation(
    start_month: NaiveDate,
    months: i32,
    initial_cash: Decimal,
    revenue_items: &[RevenueItem],
    expense_items: &[ExpenseItem],
    event_shocks: &[EventShock],
    capital_injections: &[CapitalInjection],
    dividend_policy: &Option<DividendPolicy>,
    _credit_facility: &Option<CreditFacility>, // Ignored
    capital_growth_policy: &Option<CapitalGrowthPolicy>,
    staffing_roles: &[StaffingRole],
    valuation_assumptions: &[ValuationAssumption],
    use_monte_carlo: bool,
    stop_on_insolvency: bool,
    pooling_fraction: Decimal, 
) -> SimulationResult {

    // 1. DETERMINISTIC RUN (Base Case - No Pooling)
    let deterministic_run = run_iteration(start_month, months, initial_cash, revenue_items, expense_items, event_shocks, capital_injections, dividend_policy, _credit_facility, capital_growth_policy, staffing_roles, true, stop_on_insolvency);
    let labels: Vec<String> = deterministic_run.iter().map(|d| d.date.clone()).collect();
    
    let val_assum = valuation_assumptions.first();
    let val_mult = val_assum.map(|v| v.multiplier).unwrap_or(dec!(5.0));
    let val_method = val_assum.map(|v| v.method.as_str()).unwrap_or("revenue");

    let calc_val = |data: &MonthlyData| -> Decimal {
        match val_method {
            "ebitda" => {
                let ebitda = data.net_income + data.interest_expense;
                ebitda * dec!(12.0) * val_mult 
            },
            _ => data.revenue * dec!(12.0) * val_mult, 
        }
    };

    let det_last = deterministic_run.last().unwrap();
    let deterministic_valuation = calc_val(det_last);
    let deterministic_runway = calculate_runway(det_last.cash_balance, det_last.net_income, det_last.is_solvent);

    // 2. STOCHASTIC RUNS
    let single_run_data;
    let single_run_value;
    let single_run_valuation;
    let single_run_runway;

    let mut p0_value = None;
    let mut p10_value = None;
    let mut p25_value = None;
    let mut p50_value = None;
    let mut p75_value = None;
    let mut p90_value = None;
    let mut p100_value = None;
    let mut p50_valuation = None;
    let mut p50_runway = None;
    
    let mut p50_pool_cumulative = None; 
    let mut p50_data = None;
    let mut survival_rate = None;

    if use_monte_carlo {
        // Use Breadth-First for Monte Carlo to support Pooling
        let full_runs = run_monte_carlo_breadth_first(
            start_month, months, initial_cash, revenue_items, expense_items, event_shocks, 
            capital_injections, dividend_policy, _credit_facility, capital_growth_policy, 
            staffing_roles, stop_on_insolvency, pooling_fraction
        );

        let iterations = full_runs.len();

        // Initialize vectors for percentiles
        let mut p0 = Vec::with_capacity(months as usize);
        let mut p10 = Vec::with_capacity(months as usize);
        let mut p25 = Vec::with_capacity(months as usize);
        let mut p50 = Vec::with_capacity(months as usize);
        let mut p75 = Vec::with_capacity(months as usize);
        let mut p90 = Vec::with_capacity(months as usize);
        let mut p100 = Vec::with_capacity(months as usize);
        
        let mut p50_pool = Vec::with_capacity(months as usize);
        let mut p50_full_rows = Vec::with_capacity(months as usize);
        let mut survival_rates = Vec::with_capacity(months as usize);

        // Loop through every month index
        for m in 0..(months as usize) {
            // Survival Rate
            let solvent_count = full_runs.iter().filter(|r| r[m].is_solvent).count();
            let rate = Decimal::from(solvent_count as u64) / Decimal::from(iterations as u64);
            survival_rates.push(rate);

            // Collect total_value from all runs for this month for standard percentiles
            let mut values: Vec<Decimal> = full_runs.iter().map(|r| r[m].total_value).collect();
            values.sort();

            // Calculate indices (Integer math)
            let idx_0 = 0;
            let idx_10 = iterations * 10 / 100;
            let idx_25 = iterations * 25 / 100;
            let idx_75 = iterations * 75 / 100;
            let idx_90 = iterations * 90 / 100;
            let idx_100 = iterations - 1;

            p0.push(values[idx_0]);
            p10.push(values[idx_10]);
            p25.push(values[idx_25]);
            p75.push(values[idx_75]);
            p90.push(values[idx_90]);
            p100.push(values[idx_100]);

            // Cash-Anchored Median for P50 (The "Frankenstein" Fix)
            // Sort runs by cash_balance at this month to find the representative run.
            // This ensures P50 Revenue, P50 Opex, and P50 Cash all come from the SAME simulation trajectory.
            let mut run_indices: Vec<usize> = (0..iterations).collect();
            run_indices.sort_by(|&a, &b| {
                full_runs[a][m].cash_balance.partial_cmp(&full_runs[b][m].cash_balance).unwrap_or(Ordering::Equal)
            });
            let median_idx = run_indices[iterations / 2];
            let median_run_row = &full_runs[median_idx][m];
            
            // Use the values from that specific median run for P50 consistency
            p50.push(median_run_row.total_value);
            p50_pool.push(median_run_row.cumulative_pool_received);
            
            let p50_row = median_run_row.clone();
            p50_full_rows.push(p50_row);
        }

        // Assign vectors
        p0_value = Some(p0);
        p10_value = Some(p10);
        p25_value = Some(p25);
        p50_value = Some(p50);
        p75_value = Some(p75);
        p90_value = Some(p90);
        p100_value = Some(p100);
        p50_pool_cumulative = Some(p50_pool);
        p50_data = Some(p50_full_rows);
        survival_rate = Some(survival_rates);

        // Calculate P50 Valuation (Based on anchored median revenue/run at the end)
        let last_m = (months - 1) as usize;
        let mut run_indices_last: Vec<usize> = (0..iterations).collect();
        run_indices_last.sort_by(|&a, &b| {
            full_runs[a][last_m].cash_balance.partial_cmp(&full_runs[b][last_m].cash_balance).unwrap_or(Ordering::Equal)
        });
        let median_last_idx = run_indices_last[iterations / 2];
        p50_valuation = Some(calc_val(&full_runs[median_last_idx][last_m]));

        // Calculate P50 Runway (Median of all runways)
        let mut runways: Vec<Option<i32>> = full_runs.iter().map(|r| {
            if let Some(_idx) = r.iter().position(|d| !d.is_solvent) {
                Some(0)
            } else {
                let last = r.last().unwrap();
                calculate_runway(last.cash_balance, last.net_income, last.is_solvent)
            }
        }).collect();
        
        // Sort runways (None is effectively infinite, so it goes last)
        runways.sort_by(|a, b| {
            match (a, b) {
                (Some(va), Some(vb)) => va.cmp(vb),
                (None, Some(_)) => Ordering::Greater,
                (Some(_), None) => Ordering::Less,
                (None, None) => Ordering::Equal,
            }
        });
        p50_runway = runways[iterations * 50 / 100];

        // Pick a representative run for single_run_data (Median Ending Value)
        let mut final_values: Vec<(usize, Decimal)> = full_runs.iter().enumerate().map(|(i, r)| (i, r.last().unwrap().total_value)).collect();
        final_values.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
        let median_idx = final_values[iterations / 2].0;
        single_run_data = Some(full_runs[median_idx].clone());
        
        // For single_run_value, we can just use the same representative run
        single_run_value = Some(full_runs[median_idx].iter().map(|d| d.total_value).collect());
        
        // For single_run_valuation/runway, use the same representative run
        let s_last = full_runs[median_idx].last().unwrap();
        single_run_valuation = Some(calc_val(s_last));
        single_run_runway = calculate_runway(s_last.cash_balance, s_last.net_income, s_last.is_solvent);

    } else {
        // Single Stochastic Run (No Pooling)
        let single_run = run_iteration(start_month, months, initial_cash, revenue_items, expense_items, event_shocks, capital_injections, dividend_policy, _credit_facility, capital_growth_policy, staffing_roles, false, stop_on_insolvency);
        
        single_run_value = Some(single_run.iter().map(|d| d.total_value).collect());
        
        let s_last = single_run.last().unwrap();
        single_run_valuation = Some(calc_val(s_last));
        single_run_runway = calculate_runway(s_last.cash_balance, s_last.net_income, s_last.is_solvent);
        
        single_run_data = Some(single_run);
    }

    SimulationResult {
        labels,
        valuation_method: val_method.to_string(),
        deterministic_data: deterministic_run,
        single_run_data, 
        single_run_value,
        p0_value, p10_value, p25_value, p50_value, p75_value, p90_value, p100_value,
        p50_pool_cumulative, 
        p50_data,
        survival_rate,
        deterministic_runway, deterministic_valuation,
        single_run_runway, single_run_valuation,
        p50_runway, p50_valuation,
    }
}
