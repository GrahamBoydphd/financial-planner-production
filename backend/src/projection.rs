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

fn calculate_runway(cash: Decimal, last_month_net_income: Decimal) -> Option<i32> {
    if cash < dec!(0.0) { return Some(0); }
    if last_month_net_income >= dec!(0.0) { return None; }
    let burn = -last_month_net_income;
    if burn == dec!(0.0) { return None; }
    Some((cash / burn).floor().to_i32().unwrap_or(0))
}

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

    let mut revenue_states: HashMap<Uuid, ItemState> = HashMap::new();
    let mut expense_states: HashMap<Uuid, ItemState> = HashMap::new();

    let build_sampler = |v_type: Option<&String>, rate: Decimal, 
                         min: Option<Decimal>, max: Option<Decimal>, intv: Option<i32>, 
                         scale: Option<Decimal>, free: Option<Decimal>,
                         alpha: Option<Decimal>, beta: Option<Decimal>| -> GrowthSampler {
        
        let avg = rate.to_f64().unwrap_or(0.0);
        if force_deterministic {
            return GrowthSampler::new(VolatilityModel::None { fixed_rate: avg });
        }
        let model = match v_type.map(|s| s.as_str()) {
            Some("flat") => VolatilityModel::Flat {
                average: avg,
                min: min.unwrap_or(dec!(0.0)).to_f64().unwrap_or(0.0),
                max: max.unwrap_or(dec!(0.0)).to_f64().unwrap_or(0.0),
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
    };

    let mut cap_growth_sampler = if let Some(policy) = capital_growth_policy {
        let v_type = policy.volatility_type.as_ref();
        let avg = policy.vol_mean.unwrap_or(dec!(0.0)).to_f64().unwrap_or(0.0);
        
        let model = if force_deterministic {
             VolatilityModel::None { fixed_rate: avg }
        } else {
             match v_type.map(|s| s.as_str()) {
                Some("flat") => VolatilityModel::Flat {
                    average: avg,
                    min: policy.vol_min.unwrap_or(dec!(0.0)).to_f64().unwrap_or(0.0),
                    max: policy.vol_max.unwrap_or(dec!(0.0)).to_f64().unwrap_or(0.0),
                    intervals: policy.vol_intervals.unwrap_or(1),
                },
                Some("student_t") => VolatilityModel::StudentsT {
                    mean: avg,
                    scale: policy.vol_scale.unwrap_or(dec!(0.0)).to_f64().unwrap_or(0.0),
                    freedom: policy.vol_freedom.unwrap_or(dec!(5.0)).to_f64().unwrap_or(5.0),
                },
                Some("nrig") => VolatilityModel::NRIG {
                    alpha: policy.vol_alpha.unwrap_or(dec!(1.0)).to_f64().unwrap_or(1.0),
                    beta: policy.vol_beta.unwrap_or(dec!(0.0)).to_f64().unwrap_or(0.0),
                    delta: policy.vol_scale.unwrap_or(dec!(1.0)).to_f64().unwrap_or(1.0),
                    mu: avg, 
                },
                _ => VolatilityModel::None { fixed_rate: avg },
            }
        };
        Some(GrowthSampler::new(model))
    } else {
        None
    };

    for item in revenue_items {
        revenue_states.insert(item.id, ItemState {
            current_value: item.initial_amount,
            is_active: false,
            sampler: build_sampler(item.volatility_type.as_ref(), item.growth_rate_percent, 
                item.vol_min, item.vol_max, item.vol_intervals, item.vol_scale, item.vol_freedom,
                item.vol_alpha, item.vol_beta)
        });
    }
    for item in expense_items {
        expense_states.insert(item.id, ItemState {
            current_value: item.initial_amount,
            is_active: false,
            sampler: build_sampler(item.volatility_type.as_ref(), item.growth_rate_percent, 
                item.vol_min, item.vol_max, item.vol_intervals, item.vol_scale, item.vol_freedom,
                item.vol_alpha, item.vol_beta)
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

            // --- STAFFING COSTS (SOPHISTICATED) ---
            for role in staffing_roles {
                if m >= role.start_month {
                    // 1. Determine Headcount based on Hiring Plan
                    let current_headcount = match role.hiring_plan.as_str() {
                        "monthly_rate" => {
                            let months_active = m - role.start_month; // 0-indexed relative to start
                            let rate = role.hiring_rate.unwrap_or(1).max(1); // Avoid div by zero
                            // Example: Rate 1. Month 0 -> 1 + 0 = 1. Month 1 -> 1 + 1 = 2.
                            let hired = 1 + (months_active / rate);
                            hired.min(role.target_count)
                        },
                        _ => role.target_count, // "fixed_count"
                    };

                    if current_headcount > 0 {
                        // 2. Determine Salary Inflation (Based on Plan Start)
                        // Task Instruction: "based on how many years have passed since the plan start"
                        // m=1 is start. m=13 is start of year 2 (1 year passed).
                        let years_passed = (m - 1) / 12;
                        
                        let mut current_annual_salary = role.annual_salary;
                        if years_passed > 0 {
                             let multiplier = dec!(1.0) + role.annual_increase;
                             // Simple power loop for Decimal
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
            current_debt: current_debt,
            total_value: current_cash + cum_dividends,
            is_insolvent,
        });
    }
    history
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
    stop_on_insolvency: bool
) -> SimulationResult {

    // 1. DETERMINISTIC RUN
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

    if use_monte_carlo {
        let iterations = 1000;
        let mut full_runs: Vec<Vec<MonthlyData>> = Vec::with_capacity(iterations);

        for _ in 0..iterations {
            let run = run_iteration(start_month, months, initial_cash, revenue_items, expense_items, event_shocks, capital_injections, dividend_policy, credit_facility, capital_growth_policy, staffing_roles, false, stop_on_insolvency);
            full_runs.push(run);
        }

        let mut p0 = Vec::with_capacity(months as usize);
        let mut p10 = Vec::with_capacity(months as usize);
        let mut p25 = Vec::with_capacity(months as usize);
        let mut p50 = Vec::with_capacity(months as usize);
        let mut p75 = Vec::with_capacity(months as usize);
        let mut p90 = Vec::with_capacity(months as usize);
        let mut p100 = Vec::with_capacity(months as usize);

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
        }

        p0_value = Some(p0);
        p10_value = Some(p10);
        p25_value = Some(p25);
        p50_value = Some(p50);
        p75_value = Some(p75);
        p90_value = Some(p90);
        p100_value = Some(p100);

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

    } else {
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
        deterministic_runway, deterministic_valuation,
        single_run_runway, single_run_valuation,
        p50_runway, p50_valuation,
    }
}
