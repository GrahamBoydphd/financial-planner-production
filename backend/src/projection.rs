use crate::models::{RevenueItem, ExpenseItem, EventShock, ValuationAssumption, CapitalInjection, DividendPolicy, CreditFacility, CapitalGrowthPolicy, StaffingRole};
use crate::distributions::{GrowthSampler, VolatilityModel};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{NaiveDate};
use uuid::Uuid;
use rust_decimal::prelude::ToPrimitive;

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
    pub current_debt: Decimal,
    pub total_value: Decimal,
    pub is_insolvent: bool, 
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

// Helper struct for Breadth-First Simulation
struct TrajectoryState {
    current_cash: Decimal,
    cum_external_cap: Decimal,
    cum_dividends: Decimal,
    cum_pool_received: Decimal, 
    pending_interest: Decimal,
    is_insolvent: bool,
    revenue_states: HashMap<Uuid, ItemState>,
    expense_states: HashMap<Uuid, ItemState>,
    cap_growth_sampler: Option<GrowthSampler>,
    history: Vec<MonthlyData>,
}

fn calculate_runway(cash: Decimal, last_month_net_income: Decimal) -> Option<i32> {
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
            // Use rate as default if min/max are missing to prevent 0-growth bug
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
    credit_facility: &Option<CreditFacility>,
    capital_growth_policy: &Option<CapitalGrowthPolicy>,
    staffing_roles: &[StaffingRole],
    force_deterministic: bool,
    stop_on_insolvency: bool,
) -> Vec<MonthlyData> {
    
    let mut history = Vec::with_capacity(months as usize);
    let mut current_cash = initial_cash; 
    let mut cum_external_cap = initial_cash; 
    let mut cum_dividends = dec!(0.0);
    let mut pending_interest = dec!(0.0);
    let mut is_insolvent = false;
    let mut cumulative_pool_received = dec!(0.0); 

    let mut revenue_states: HashMap<Uuid, ItemState> = HashMap::new();
    let mut expense_states: HashMap<Uuid, ItemState> = HashMap::new();

    let mut cap_growth_sampler = if let Some(policy) = capital_growth_policy {
        Some(create_sampler(force_deterministic, policy.volatility_type.as_ref(), policy.growth_rate_percent.unwrap_or(dec!(0.0)),
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

    let credit_floor = if let Some(f) = credit_facility {
        -f.facility_limit
    } else {
        dec!(0.0)
    };

    for m in 1..=months {
        let current_date = start_month.checked_add_months(chrono::Months::new((m - 1) as u32)).unwrap_or(start_month);
        let date_str = current_date.format("%Y-%m-%d").to_string();

        if stop_on_insolvency && current_cash < credit_floor {
            is_insolvent = true;
        }

        let mut monthly_rev = dec!(0.0);
        let mut monthly_cogs = dec!(0.0);
        let mut monthly_opex = dec!(0.0);

        if !is_insolvent {
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
        }

        let monthly_interest = pending_interest; 
        let gross_profit = monthly_rev - monthly_cogs;
        let total_expenses = monthly_opex + monthly_interest;
        let net_income = gross_profit - total_expenses;
        
        current_cash += net_income;

        if let Some(injection) = injection_map.get(&m) {
            current_cash += injection;
            cum_external_cap += injection;
            if current_cash >= credit_floor {
                is_insolvent = false;
            }
        }

        let mut dividend_paid = dec!(0.0);
        if !is_insolvent {
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
        }

        if current_cash > dec!(0.0) {
            if let Some(sampler) = &mut cap_growth_sampler {
                let growth_rate = sampler.sample(); 
                let multiplier = dec!(1.0) + (growth_rate / dec!(100.0));
                current_cash *= multiplier;
            }
        }

        pending_interest = dec!(0.0); 
        let mut current_debt = dec!(0.0); 
        if current_cash < dec!(0.0) {
            current_debt = current_cash.abs();
            if let Some(facility) = credit_facility {
                let rate = if facility.is_annual_rate { facility.interest_rate / dec!(12.0) } else { facility.interest_rate };
                pending_interest = current_debt * (rate / dec!(100.0));
            }
        }

        history.push(MonthlyData {
            month_index: m,
            date: date_str,
            revenue: monthly_rev,
            cogs: monthly_cogs,
            gross_profit: gross_profit,
            opex: monthly_opex,
            interest_expense: monthly_interest,
            net_income: net_income,
            cash_balance: current_cash,
            dividend_paid: dividend_paid,
            cumulative_dividends: cum_dividends,
            cumulative_external_capital: cum_external_cap,
            cumulative_pool_received: cumulative_pool_received,
            current_debt: current_debt,
            total_value: current_cash + cum_dividends,
            is_insolvent,
        });
    }
    history
}

// Breadth-First Simulation (Monte Carlo with Pooling)
fn run_monte_carlo_breadth_first(
    start_month: NaiveDate,
    months: i32,
    initial_cash: Decimal,
    revenue_items: &[RevenueItem],
    expense_items: &[ExpenseItem],
    event_shocks: &[EventShock],
    capital_injections: &[CapitalInjection],
    dividend_policy: &Option<DividendPolicy>,
    credit_facility: &Option<CreditFacility>,
    capital_growth_policy: &Option<CapitalGrowthPolicy>,
    staffing_roles: &[StaffingRole],
    stop_on_insolvency: bool,
    pooling_fraction: Decimal,
) -> Vec<Vec<MonthlyData>> {

    let iterations = 1000;
    let mut trajectories = Vec::with_capacity(iterations);

    // 1. Initialize Trajectories
    let mut shock_map: HashMap<i32, Vec<&EventShock>> = HashMap::new();
    for shock in event_shocks { shock_map.entry(shock.shock_month).or_default().push(shock); }

    let mut injection_map: HashMap<i32, Decimal> = HashMap::new();
    for cap in capital_injections { *injection_map.entry(cap.month).or_default() += cap.amount; }

    let credit_floor = if let Some(f) = credit_facility { -f.facility_limit } else { dec!(0.0) };

    for _ in 0..iterations {
        let mut current_cash = initial_cash;
        let mut cum_external_cap = initial_cash;
        
        if let Some(pre_seed) = injection_map.get(&0) {
            current_cash += pre_seed;
            cum_external_cap += pre_seed;
        }

        let mut revenue_states = HashMap::new();
        for item in revenue_items {
            revenue_states.insert(item.id, ItemState {
                current_value: item.initial_amount,
                is_active: false,
                sampler: create_sampler(false, item.volatility_type.as_ref(), item.growth_rate_percent, 
                    item.vol_min, item.vol_max, item.vol_intervals, item.vol_scale, item.vol_freedom, item.vol_alpha, item.vol_beta)
            });
        }

        let mut expense_states = HashMap::new();
        for item in expense_items {
            expense_states.insert(item.id, ItemState {
                current_value: item.initial_amount,
                is_active: false,
                sampler: create_sampler(false, item.volatility_type.as_ref(), item.growth_rate_percent, 
                    item.vol_min, item.vol_max, item.vol_intervals, item.vol_scale, item.vol_freedom, item.vol_alpha, item.vol_beta)
            });
        }

        let cap_growth_sampler = if let Some(policy) = capital_growth_policy {
            Some(create_sampler(false, policy.volatility_type.as_ref(), policy.growth_rate_percent.unwrap_or(dec!(0.0)),
                policy.vol_min, policy.vol_max, policy.vol_intervals, policy.vol_scale, policy.vol_freedom, policy.vol_alpha, policy.vol_beta))
        } else {
            None
        };

        trajectories.push(TrajectoryState {
            current_cash,
            cum_external_cap,
            cum_dividends: dec!(0.0),
            cum_pool_received: dec!(0.0), 
            pending_interest: dec!(0.0),
            is_insolvent: false,
            revenue_states,
            expense_states,
            cap_growth_sampler,
            history: Vec::with_capacity(months as usize),
        });
    }

    // 2. Breadth-First Loop
    for m in 1..=months {
        let current_date = start_month.checked_add_months(chrono::Months::new((m - 1) as u32)).unwrap_or(start_month);
        let date_str = current_date.format("%Y-%m-%d").to_string();

        let mut monthly_pool = dec!(0.0);
        // Store intermediate results: (rev, cogs, gp, opex, interest, op_profit, contribution, inv_gain)
        let mut trajectory_financials = Vec::with_capacity(iterations);

        // Phase 1: Calculate Financials & Pool Contribution
        for state in trajectories.iter_mut() {
            if stop_on_insolvency && state.current_cash < credit_floor {
                state.is_insolvent = true;
            }

            let mut monthly_rev = dec!(0.0);
            let mut monthly_cogs = dec!(0.0);
            let mut monthly_opex = dec!(0.0);

            if !state.is_insolvent {
                // Revenue
                for item in revenue_items {
                    let s = state.revenue_states.get_mut(&item.id).unwrap();
                    if m == item.start_month { s.is_active = true; s.current_value = item.initial_amount; }
                    else if let Some(end) = item.end_month { if m > end { s.is_active = false; } }

                    if s.is_active {
                        if item.frequency == "One-time" && m != item.start_month { continue; }
                        if m > item.start_month {
                            let rate = s.sampler.sample();
                            s.current_value *= dec!(1.0) + rate / dec!(100.0);
                        }
                        let item_rev = s.current_value;
                        monthly_rev += item_rev;
                        if let Some(cogs_pct) = item.cost_of_revenue_percent {
                            monthly_cogs += item_rev * (cogs_pct / dec!(100.0));
                        }
                    }
                }

                // Expenses
                for item in expense_items {
                    let s = state.expense_states.get_mut(&item.id).unwrap();
                    if m == item.start_month { s.is_active = true; s.current_value = item.initial_amount; }
                    else if let Some(end) = item.end_month { if m > end { s.is_active = false; } }

                    if s.is_active {
                        if item.frequency == "One-time" && m != item.start_month { continue; }
                        if m > item.start_month {
                            let rate = s.sampler.sample();
                            s.current_value *= dec!(1.0) + rate / dec!(100.0);
                        }
                        let mut amt = s.current_value;
                        if let Some(pct) = item.pct_of_revenue { amt += monthly_rev * (pct / dec!(100.0)); }
                        monthly_opex += amt;
                    }
                }

                // Staffing
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

                // Shocks
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
            }

            let monthly_interest = state.pending_interest;
            let gross_profit = monthly_rev - monthly_cogs;
            let total_expenses = monthly_opex + monthly_interest;
            let operating_profit = gross_profit - total_expenses;

            // 1. Update Cash with Operating Flow
            state.current_cash += operating_profit;

            // 2. Calculate Investment Result (Treasury)
            let mut investment_gain = dec!(0.0);
            if state.current_cash > dec!(0.0) {
                if let Some(sampler) = &mut state.cap_growth_sampler {
                    let growth_rate = sampler.sample();
                    investment_gain = state.current_cash * (growth_rate / dec!(100.0));
                }
            }
            // 3. Update Cash with Investment Flow
            state.current_cash += investment_gain;

            // 4. Pooling Logic
            let mut contribution = dec!(0.0);
            if pooling_fraction > dec!(0.0) {
                // Poolable Income = Max(0, OpProfit) + Max(0, InvGain)
                let op_gain = if operating_profit > dec!(0.0) { operating_profit } else { dec!(0.0) };
                let inv_gain = if investment_gain > dec!(0.0) { investment_gain } else { dec!(0.0) };
                let poolable_income = op_gain + inv_gain;
                
                contribution = poolable_income * pooling_fraction;
                monthly_pool += contribution;
            }

            // 5. Subtract Pool Contribution
            state.current_cash -= contribution;

            // Store intermediate results
            trajectory_financials.push((monthly_rev, monthly_cogs, gross_profit, monthly_opex, monthly_interest, operating_profit, contribution, investment_gain));
        }

        // Phase 2: Distribute Pool & Finalize
        let pool_share = if iterations > 0 { monthly_pool / Decimal::from(iterations) } else { dec!(0.0) };

        for (i, state) in trajectories.iter_mut().enumerate() {
            let (rev, cogs, gp, opex, interest, op_profit, contribution, inv_gain) = trajectory_financials[i];
            
            // 6. Receive Share
            state.current_cash += pool_share;
            state.cum_pool_received += pool_share; 
            
            // 7. Capital Injections
            if let Some(injection) = injection_map.get(&m) {
                state.current_cash += injection;
                state.cum_external_cap += injection;
                if state.current_cash >= credit_floor {
                    state.is_insolvent = false;
                }
            }

            // 8. Dividends
            let mut dividend_paid = dec!(0.0);
            if !state.is_insolvent {
                if let Some(policy) = dividend_policy {
                    if policy.is_enabled {
                        let surplus = state.current_cash - policy.safety_threshold;
                        if surplus > dec!(0.0) {
                            dividend_paid = surplus * (policy.payout_ratio / dec!(100.0));
                            state.current_cash -= dividend_paid;
                            state.cum_dividends += dividend_paid;
                        }
                    }
                }
            }

            // Debt Interest for Next Month
            state.pending_interest = dec!(0.0);
            let mut current_debt = dec!(0.0);
            if state.current_cash < dec!(0.0) {
                current_debt = state.current_cash.abs();
                if let Some(facility) = credit_facility {
                    let rate = if facility.is_annual_rate { facility.interest_rate / dec!(12.0) } else { facility.interest_rate };
                    state.pending_interest = current_debt * (rate / dec!(100.0));
                }
            }

            // Adjusted Net Income for reporting (Includes Op, Inv, and Pooling effects)
            let adjusted_net_income = op_profit + inv_gain - contribution + pool_share;

            state.history.push(MonthlyData {
                month_index: m,
                date: date_str.clone(),
                revenue: rev,
                cogs: cogs,
                gross_profit: gp,
                opex: opex,
                interest_expense: interest,
                net_income: adjusted_net_income, 
                cash_balance: state.current_cash,
                dividend_paid,
                cumulative_dividends: state.cum_dividends,
                cumulative_external_capital: state.cum_external_cap,
                cumulative_pool_received: state.cum_pool_received, 
                current_debt,
                total_value: state.current_cash + state.cum_dividends,
                is_insolvent: state.is_insolvent,
            });
        }
    }

    trajectories.into_iter().map(|t| t.history).collect()
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
    credit_facility: &Option<CreditFacility>,
    capital_growth_policy: &Option<CapitalGrowthPolicy>,
    staffing_roles: &[StaffingRole],
    valuation_assumptions: &[ValuationAssumption],
    use_monte_carlo: bool,
    stop_on_insolvency: bool,
    pooling_fraction: Decimal, 
) -> SimulationResult {

    // 1. DETERMINISTIC RUN (Base Case - No Pooling)
    let deterministic_run = run_iteration(start_month, months, initial_cash, revenue_items, expense_items, event_shocks, capital_injections, dividend_policy, credit_facility, capital_growth_policy, staffing_roles, true, stop_on_insolvency);
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
    let deterministic_runway = calculate_runway(det_last.cash_balance, det_last.net_income);

    // 2. STOCHASTIC RUNS
    let mut single_run_data = None;
    let mut single_run_value = None;
    let mut single_run_valuation = None;
    let mut single_run_runway = None;

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

    if use_monte_carlo {
        // Use Breadth-First for Monte Carlo to support Pooling
        let mut full_runs = run_monte_carlo_breadth_first(
            start_month, months, initial_cash, revenue_items, expense_items, event_shocks, 
            capital_injections, dividend_policy, credit_facility, capital_growth_policy, 
            staffing_roles, stop_on_insolvency, pooling_fraction
        );

        let iterations = full_runs.len();
        let mut p0 = Vec::with_capacity(months as usize);
        let mut p10 = Vec::with_capacity(months as usize);
        let mut p25 = Vec::with_capacity(months as usize);
        let mut p50 = Vec::with_capacity(months as usize);
        let mut p75 = Vec::with_capacity(months as usize);
        let mut p90 = Vec::with_capacity(months as usize);
        let mut p100 = Vec::with_capacity(months as usize);
        
        let mut p50_pool = Vec::with_capacity(months as usize); 

        for m in 0..(months as usize) {
            let mut values: Vec<Decimal> = full_runs.iter().map(|r| r[m].total_value).collect();
            values.sort();

            let idx_10 = (iterations as f64 * 0.10) as usize;
            let idx_25 = (iterations as f64 * 0.25) as usize;
            let idx_50 = (iterations as f64 * 0.50) as usize;
            let idx_75 = (iterations as f64 * 0.75) as usize;
            let idx_90 = (iterations as f64 * 0.90) as usize;
            
            p0.push(values[0]);
            p10.push(values[idx_10]);
            p25.push(values[idx_25]);
            p50.push(values[idx_50]);
            p75.push(values[idx_75]);
            p90.push(values[idx_90]);
            p100.push(values[iterations - 1]);

            // Calculate P50 Pool Cumulative
            let mut pool_values: Vec<Decimal> = full_runs.iter().map(|r| r[m].cumulative_pool_received).collect();
            pool_values.sort();
            p50_pool.push(pool_values[idx_50]);
        }

        p0_value = Some(p0);
        p10_value = Some(p10);
        p25_value = Some(p25);
        p50_value = Some(p50);
        p75_value = Some(p75);
        p90_value = Some(p90);
        p100_value = Some(p100);
        
        p50_pool_cumulative = Some(p50_pool); 

        full_runs.sort_by(|a, b| {
            let val_a = a.last().unwrap().total_value;
            let val_b = b.last().unwrap().total_value;
            val_a.partial_cmp(&val_b).unwrap()
        });

        let median_run_idx = (iterations as f64 * 0.50) as usize;
        let median_run = &full_runs[median_run_idx];
        let median_last = median_run.last().unwrap();

        p50_valuation = Some(calc_val(median_last));
        p50_runway = calculate_runway(median_last.cash_balance, median_last.net_income);
        
        // Populate single_run_data with the median run so frontend can visualize details (like pool)
        single_run_data = Some(median_run.clone());

    } else {
        // Single Stochastic Run (No Pooling)
        let single_run = run_iteration(start_month, months, initial_cash, revenue_items, expense_items, event_shocks, capital_injections, dividend_policy, credit_facility, capital_growth_policy, staffing_roles, false, stop_on_insolvency);
        
        single_run_value = Some(single_run.iter().map(|d| d.total_value).collect());
        
        let s_last = single_run.last().unwrap();
        single_run_valuation = Some(calc_val(s_last));
        single_run_runway = calculate_runway(s_last.cash_balance, s_last.net_income);
        
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
        deterministic_runway, deterministic_valuation,
        single_run_runway, single_run_valuation,
        p50_runway, p50_valuation,
    }
}
