🤖 Connecting to gemini-3-pro-preview (Paid Tier)...
Here are the refactored files to implement the Sophisticated Staffing Logic.

### 1. Backend Models (`backend/src/models.rs`)
Updated `StaffingRole` struct to include `target_count` (renamed from `count`), `hiring_plan`, and `hiring_rate`.

```rust
--- START FILE: backend/src/models.rs ---
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{NaiveDate, DateTime, Utc};
use rust_decimal::Decimal;

// --- Phase 3: Portfolio Structure ---

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Fund {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Company {
    pub id: Uuid,
    pub fund_id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub industry: Option<String>,
    pub business_model: Option<String>,
    pub technology: Option<String>,
}

// --- Phase 1 & 2: Financial Models ---

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct FinancialPlan {
    pub id: Uuid,
    pub company_id: Uuid,
    pub name: String,
    pub start_month: NaiveDate,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct RevenueItem {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub name: String,
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
    pub vol_mean: Option<Decimal>,
    pub vol_scale: Option<Decimal>,
    pub vol_freedom: Option<Decimal>,
    pub vol_alpha: Option<Decimal>,
    pub vol_beta: Option<Decimal>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ExpenseItem {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub name: String,
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
    pub vol_mean: Option<Decimal>,
    pub vol_scale: Option<Decimal>,
    pub vol_freedom: Option<Decimal>,
    pub vol_alpha: Option<Decimal>,
    pub vol_beta: Option<Decimal>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct CapitalInjection {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub name: String,
    pub amount: Decimal,
    pub month: i32,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct DividendPolicy {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub is_enabled: bool,
    pub safety_threshold: Decimal,
    pub payout_ratio: Decimal,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct CreditFacility {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub facility_limit: Decimal,
    pub interest_rate: Decimal,
    pub is_annual_rate: bool,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ValuationAssumption {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub name: String,
    pub method: String,
    pub multiplier: Decimal,
    pub date_applied: Option<NaiveDate>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct EventShock {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub name: String,
    pub shock_month: i32,
    pub impact_type: String,
    pub impact_value: Decimal,
    pub duration_months: Option<i32>,
}

#[derive(Serialize, FromRow)]
pub struct CapitalGrowthPolicy {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub volatility_type: Option<String>,
    pub vol_min: Option<Decimal>,
    pub vol_max: Option<Decimal>,
    pub vol_intervals: Option<i32>,
    pub vol_mean: Option<Decimal>,
    pub vol_scale: Option<Decimal>,
    pub vol_freedom: Option<Decimal>,
    pub vol_alpha: Option<Decimal>,
    pub vol_beta: Option<Decimal>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Deserialize, Debug)]
pub struct CreateFundRequest {
    pub name: String,
}

#[derive(Deserialize, Debug)]
pub struct CreateCompanyRequest {
    pub fund_id: uuid::Uuid,
    pub name: String,
    pub business_model: Option<String>,
    pub industry: Option<String>,
    pub technology: Option<String>,
}

// --- Point 9: Staffing & Payroll ---
#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct StaffingRole {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub role_name: String,
    pub annual_salary: Decimal,
    pub start_month: i32,
    
    // Renamed from 'count' to 'target_count' to match sophisticated logic
    // Assumes DB column is 'target_count'
    pub target_count: i32, 
    
    // New Fields for Sophisticated Logic
    pub hiring_plan: String, // "fixed_count" or "monthly_rate"
    pub hiring_rate: Option<i32>, // e.g., 1 = hire every month, 2 = hire every 2 months
    
    pub annual_increase: Decimal,
    pub created_at: DateTime<Utc>,
}
--- END FILE: backend/src/models.rs ---
```

### 2. Backend Projection Engine (`backend/src/projection.rs`)
Updated the simulation loop to calculate dynamic headcount based on `hiring_plan` and apply inflation based on years since Plan Start.

```rust
--- START FILE: backend/src/projection.rs ---
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
        deterministic_data: deterministic_run,
        single_run_data, 
        single_run_value,
        p0_value, p10_value, p25_value, p50_value, p75_value, p90_value, p100_value,
        deterministic_runway, deterministic_valuation,
        single_run_runway, single_run_valuation,
        p50_runway, p50_valuation,
    }
}
--- END FILE: backend/src/projection.rs ---
```

### 3. Frontend API (`frontend/lib/api.ts`)
Updated `StaffingRole` interface to match the backend changes.

```typescript
--- START FILE: frontend/lib/api.ts ---
import axios from 'axios';

const API_URL = 'http://localhost:8000';

// --- INTERFACES ---
export interface Fund {
  id: string;
  name: string;
  created_at: string;
}

export interface Company {
  id: string;
  fund_id: string;
  name: string;
  industry?: string;
  business_model?: string;
  created_at: string;
}

export interface FinancialPlan {
  id: string;
  company_id: string;
  name: string;
  start_month: string;
  initial_cash: number;
}

export interface RevenueItem {
  id: string;
  plan_id: string;
  name: string;
  source: string;
  initial_amount: number;
  growth_rate_percent: number;
  start_month: number;
  end_month?: number;
  frequency: string;
  cost_of_revenue_percent?: number;
  volatility_type?: string;
  vol_min?: number;
  vol_max?: number;
  vol_intervals?: number;
  vol_mean?: number;
  vol_scale?: number;
  vol_freedom?: number;
  vol_alpha?: number;
  vol_beta?: number;
}

export interface ExpenseItem {
  id: string;
  plan_id: string;
  name: string;
  category: string;
  initial_amount: number;
  growth_rate_percent: number;
  start_month: number;
  end_month?: number;
  frequency: string;
  pct_of_revenue?: number;
  volatility_type?: string;
  vol_min?: number;
  vol_max?: number;
  vol_intervals?: number;
  vol_mean?: number;
  vol_scale?: number;
  vol_freedom?: number;
  vol_alpha?: number;
  vol_beta?: number;
}

export interface CapitalGrowthPolicy {
  id: string;
  plan_id: string;
  volatility_type: 'none' | 'flat' | 'student_t' | 'nrig';
  vol_min?: number;
  vol_max?: number;
  vol_intervals?: number;
  vol_mean?: number;
  vol_scale?: number;
  vol_freedom?: number;
  vol_alpha?: number;
  vol_beta?: number;
}

export interface CapitalInjection {
  id: string;
  plan_id: string;
  name: string;
  amount: number;
  month: number;
}

export interface DividendPolicy {
  id: string;
  plan_id: string;
  is_enabled: boolean;
  safety_threshold: number;
  payout_ratio: number;
}

export interface CreditFacility {
  id: string;
  plan_id: string;
  facility_limit: number;
  interest_rate: number;
  is_annual_rate: boolean;
}

export interface StaffingRole {
  id: string;
  plan_id: string;
  role_name: string;
  annual_salary: number;
  start_month: number;
  target_count: number; // Renamed from count
  hiring_plan: 'fixed_count' | 'monthly_rate'; // New
  hiring_rate?: number; // New
  annual_increase: number;
}

export interface MonthlyData {
  month_index: number;
  date: string;
  revenue: number | string;
  cogs: number | string;
  gross_profit: number | string;
  opex: number | string;
  interest_expense: number | string;
  net_income: number | string;
  cash_balance: number | string;
  dividend_paid: number | string;
  cumulative_dividends: number | string;
  cumulative_external_capital: number | string;
  current_debt: number | string;
  total_value: number | string;
  is_insolvent: boolean;
}

export interface SimulationResult {
  labels: string[];
  deterministic_data: MonthlyData[];
  single_run_data?: MonthlyData[];
  single_run_value?: (number | string)[];

  p0_value?: (number | string)[];
  p10_value?: (number | string)[];
  p25_value?: (number | string)[];
  p50_value?: (number | string)[];
  p75_value?: (number | string)[];
  p90_value?: (number | string)[];
  p100_value?: (number | string)[];

  deterministic_runway?: number;
  deterministic_valuation: number | string;

  single_run_runway?: number;
  single_run_valuation?: number | string;

  p50_runway?: number;
  p50_valuation?: number | string;
}

// --- API OBJECT ---
export const api = {
  // FUNDS
  getFunds: async () => (await axios.get<Fund[]>(`${API_URL}/api/funds`)).data,
  getFund: async (id: string) => (await axios.get<Fund>(`${API_URL}/api/funds/${id}`)).data,
  createFund: async (name: string, user_id: string) => 
    (await axios.post<Fund>(`${API_URL}/api/funds`, { name, user_id })).data,

  // COMPANIES
  getCompanies: async () => (await axios.get<Company[]>(`${API_URL}/api/companies`)).data,
  getCompany: async (id: string) => (await axios.get<Company>(`${API_URL}/api/companies/${id}`)).data,
  createCompany: async (name: string, fund_id: string, industry?: string, business_model?: string, technology?: string) => 
    (await axios.post<Company>(`${API_URL}/api/companies`, { name, fund_id, industry, business_model, technology })).data,

  // PLANS
  getPlans: async () => (await axios.get<FinancialPlan[]>(`${API_URL}/api/plans`)).data,
  getPlan: async (id: string) => (await axios.get<FinancialPlan>(`${API_URL}/api/plans/${id}`)).data,
  createPlan: async (company_id: string, name: string, start_month: string) => 
    (await axios.post<FinancialPlan>(`${API_URL}/api/plans`, { company_id, name, start_month })).data,
  getProjection: async (planId: string, params?: { mode?: string, months?: number, stop_insolvency?: boolean, initial_cash?: number }) => 
    (await axios.get<SimulationResult>(`${API_URL}/api/plans/${planId}/projection`, { params })).data,

  // REVENUE
  getRevenueItems: async (planId: string) => (await axios.get<RevenueItem[]>(`${API_URL}/api/plans/${planId}/revenue`)).data,
  createRevenueItem: async (item: Omit<RevenueItem, 'id'>) => (await axios.post<RevenueItem>(`${API_URL}/api/revenue`, item)).data,
  updateRevenueItem: async (id: string, item: Partial<RevenueItem>) => (await axios.put<RevenueItem>(`${API_URL}/api/revenue/${id}`, item)).data,
  deleteRevenueItem: async (id: string) => (await axios.delete(`${API_URL}/api/revenue/${id}`)),

  // EXPENSES
  getExpenseItems: async (planId: string) => (await axios.get<ExpenseItem[]>(`${API_URL}/api/plans/${planId}/expenses`)).data,
  createExpenseItem: async (item: Omit<ExpenseItem, 'id'>) => (await axios.post<ExpenseItem>(`${API_URL}/api/expenses`, item)).data,
  updateExpenseItem: async (id: string, item: Partial<ExpenseItem>) => (await axios.put<ExpenseItem>(`${API_URL}/api/expenses/${id}`, item)).data,
  deleteExpenseItem: async (id: string) => (await axios.delete(`${API_URL}/api/expenses/${id}`)),

  // STAFFING
  getStaffingRoles: async (planId: string) => (await axios.get<StaffingRole[]>(`${API_URL}/api/plans/${planId}/staffing`)).data,
  createStaffingRole: async (role: Omit<StaffingRole, 'id'>) => (await axios.post<StaffingRole>(`${API_URL}/api/staffing`, role)).data,
  updateStaffingRole: async (role: Omit<StaffingRole, 'plan_id'> & { plan_id?: string }) => (await axios.put<StaffingRole>(`${API_URL}/api/staffing/${role.id}`, role)).data,
  deleteStaffingRole: async (id: string) => (await axios.delete(`${API_URL}/api/staffing/${id}`)).data,

  // CAPITAL GROWTH (Treasury)
  getCapitalGrowth: async (planId: string) => (await axios.get<CapitalGrowthPolicy>(`${API_URL}/api/plans/${planId}/capital-growth`)).data,
  upsertCapitalGrowth: async (item: Omit<CapitalGrowthPolicy, 'id'>) => 
    (await axios.post<CapitalGrowthPolicy>(`${API_URL}/api/capital-growth`, item)).data,

  // CAPITAL INJECTIONS
  getCapitalInjections: async (planId: string) => 
    (await axios.get<CapitalInjection[]>(`${API_URL}/api/plans/${planId}/capital`)).data,
  createCapitalInjection: async (item: Omit<CapitalInjection, 'id'>) => 
    (await axios.post<CapitalInjection>(`${API_URL}/api/capital`, item)).data,
  deleteCapitalInjection: async (id: string) => 
    (await axios.delete(`${API_URL}/api/capital/${id}`)),

  // DIVIDENDS
  getDividends: async (planId: string) => 
    (await axios.get<DividendPolicy>(`${API_URL}/api/plans/${planId}/dividends`)).data,
  upsertDividends: async (item: Omit<DividendPolicy, 'id'>) => 
    (await axios.post<DividendPolicy>(`${API_URL}/api/dividends`, item)).data,

  // CREDIT
  getCredit: async (planId: string) => 
    (await axios.get<CreditFacility>(`${API_URL}/api/plans/${planId}/credit`)).data,
  upsertCredit: async (item: Omit<CreditFacility, 'id'>) => 
    (await axios.post<CreditFacility>(`${API_URL}/api/credit`, item)).data,

  // VALUATION
  createValuation: async (item: { plan_id: string, revenue_multiple?: number, ebitda_multiple?: number }) => 
    (await axios.post(`${API_URL}/api/valuation`, item)).data,
    
  // --- DELETE METHODS ---
  deleteFund: async (id: string) => {
    const res = await fetch(`${API_URL}/api/funds/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete fund');
  },

  deleteCompany: async (id: string) => {
    const res = await fetch(`${API_URL}/api/companies/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete company');
  },  
};
--- END FILE: frontend/lib/api.ts ---
```

### 4. Frontend Form (`frontend/components/forms/StaffingForm.tsx`)
Refactored to include inputs for Hiring Plan, Hiring Rate, and Target Count.

```tsx
--- START FILE: frontend/components/forms/StaffingForm.tsx ---
"use client"

import React, { useState, useEffect } from "react"
import { Plus, Trash2, Edit2, Save, X, Users, DollarSign, Calendar, TrendingUp, Briefcase } from "lucide-react"
import { StaffingRole } from "@/lib/api"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Tooltip from "@/components/ui/Tooltip"

interface StaffingFormProps {
  planId: string
  initialRoles: StaffingRole[]
  onSave: (role: Omit<StaffingRole, "id" | "plan_id"> & { id?: string }) => Promise<void>
  onDelete: (roleId: string) => Promise<void>
}

// Helper to format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Helper to format percentage
const formatPercent = (value: number) => {
  return `${(value * 100).toFixed(1)}%`;
}

export default function StaffingForm({ planId, initialRoles, onSave, onDelete }: StaffingFormProps) {
  const [roles, setRoles] = useState<StaffingRole[]>(initialRoles)
  const [isEditing, setIsEditing] = useState(false)
  const [currentRole, setCurrentRole] = useState<Partial<StaffingRole>>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Update local state when initialRoles changes
  useEffect(() => {
    setRoles(initialRoles)
  }, [initialRoles])

  const handleAddNew = () => {
    setCurrentRole({
      role_name: "",
      annual_salary: 50000,
      start_month: 1,
      target_count: 1,
      hiring_plan: "fixed_count",
      hiring_rate: 1,
      annual_increase: 0.03
    })
    setIsEditing(true)
    setError(null)
  }

  const handleEdit = (role: StaffingRole) => {
    setCurrentRole({ ...role })
    setIsEditing(true)
    setError(null)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this role?")) {
      try {
        setIsLoading(true)
        await onDelete(id)
        // Optimistic update
        setRoles(roles.filter(r => r.id !== id))
      } catch (err) {
        console.error("Failed to delete role:", err)
        setError("Failed to delete role. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setCurrentRole({})
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentRole.role_name) {
      setError("Role Name is required")
      return
    }

    try {
      setIsLoading(true)
      const roleData = {
        role_name: currentRole.role_name,
        annual_salary: Number(currentRole.annual_salary) || 0,
        start_month: Number(currentRole.start_month) || 1,
        target_count: Number(currentRole.target_count) || 1,
        hiring_plan: currentRole.hiring_plan || "fixed_count",
        hiring_rate: currentRole.hiring_plan === "monthly_rate" ? (Number(currentRole.hiring_rate) || 1) : undefined,
        annual_increase: Number(currentRole.annual_increase) || 0
      }

      await onSave({
        ...roleData,
        id: currentRole.id // Include ID if editing
      })

      setIsEditing(false)
      setCurrentRole({})
    } catch (err) {
      console.error("Failed to save role:", err)
      setError("Failed to save role. Please check your inputs.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staffing & Payroll
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Manage headcount, salaries, and hiring timelines.
            </p>
          </div>
          {!isEditing && (
            <Button onClick={handleAddNew} className="gap-1 flex items-center text-sm">
              <Plus className="h-4 w-4" /> Add Role
            </Button>
          )}
        </div>
      
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded mb-4 border border-red-200">
            <h4 className="font-bold text-sm">Error</h4>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4 border p-4 rounded-md bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="role_name" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Role Name <span className="text-red-500">*</span>
                  <Tooltip content="Title of the position (e.g., 'Sales Rep', 'Developer')." />
                </label>
                <input
                  id="role_name"
                  value={currentRole.role_name || ""}
                  onChange={(e) => setCurrentRole({ ...currentRole, role_name: e.target.value })}
                  placeholder="e.g. Sales Representative"
                  className="w-full rounded border-gray-300 border p-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="annual_salary" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Annual Salary
                  <Tooltip content="Base annual salary per person in this role." />
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="annual_salary"
                    type="number"
                    min="0"
                    className="w-full rounded border-gray-300 border p-2 pl-8 text-sm"
                    value={currentRole.annual_salary || ""}
                    onChange={(e) => setCurrentRole({ ...currentRole, annual_salary: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="hiring_plan" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Hiring Plan
                  <Tooltip content="How employees are added over time." />
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <select
                    id="hiring_plan"
                    className="w-full rounded border-gray-300 border p-2 pl-8 text-sm bg-white"
                    value={currentRole.hiring_plan || "fixed_count"}
                    onChange={(e) => setCurrentRole({ ...currentRole, hiring_plan: e.target.value as any })}
                  >
                    <option value="fixed_count">Fixed Count (All at once)</option>
                    <option value="monthly_rate">Ramp Up (Over time)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="target_count" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Target Headcount
                  <Tooltip content="Maximum number of people to hire for this role." />
                </label>
                <div className="relative">
                  <Users className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="target_count"
                    type="number"
                    min="1"
                    step="1"
                    className="w-full rounded border-gray-300 border p-2 pl-8 text-sm"
                    value={currentRole.target_count || ""}
                    onChange={(e) => setCurrentRole({ ...currentRole, target_count: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              {currentRole.hiring_plan === "monthly_rate" && (
                <div className="space-y-2">
                  <label htmlFor="hiring_rate" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                    Hiring Pace (Months per Hire)
                    <Tooltip content="Hire 1 person every X months. (e.g., 1 = monthly, 3 = quarterly)." />
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      id="hiring_rate"
                      type="number"
                      min="1"
                      step="1"
                      className="w-full rounded border-gray-300 border p-2 pl-8 text-sm"
                      value={currentRole.hiring_rate || ""}
                      onChange={(e) => setCurrentRole({ ...currentRole, hiring_rate: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="start_month" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Start Month
                  <Tooltip content="Month number (1-60) when hiring begins." />
                </label>
                <div className="relative">
                  <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="start_month"
                    type="number"
                    min="1"
                    max="60"
                    className="w-full rounded border-gray-300 border p-2 pl-8 text-sm"
                    value={currentRole.start_month || ""}
                    onChange={(e) => setCurrentRole({ ...currentRole, start_month: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="annual_increase" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  Annual Increase
                  <Tooltip content="Expected annual salary increase (e.g., 0.03 for 3%)." />
                </label>
                <div className="relative">
                  <TrendingUp className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    id="annual_increase"
                    type="number"
                    step="0.001"
                    min="0"
                    max="1"
                    className="w-full rounded border-gray-300 border p-2 pl-8 text-sm"
                    value={currentRole.annual_increase || ""}
                    onChange={(e) => setCurrentRole({ ...currentRole, annual_increase: parseFloat(e.target.value) })}
                  />
                </div>
                <p className="text-xs text-gray-500 text-right">
                  {((currentRole.annual_increase || 0) * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={handleCancel} disabled={isLoading} className="flex items-center">
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="flex items-center">
                <Save className="h-4 w-4 mr-1" /> {currentRole.id ? "Update Role" : "Add Role"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Role Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Salary (Annual)</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Plan</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Target</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Start</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {roles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      No staffing roles defined yet. Click "Add Role" to begin.
                    </td>
                  </tr>
                ) : (
                  roles.map((role) => (
                    <tr key={role.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{role.role_name}</td>
                      <td className="px-4 py-3">{formatCurrency(role.annual_salary)}</td>
                      <td className="px-4 py-3">
                        {role.hiring_plan === "monthly_rate" 
                          ? `Ramp (1/${role.hiring_rate || 1}mo)` 
                          : "Fixed"}
                      </td>
                      <td className="px-4 py-3">{role.target_count}</td>
                      <td className="px-4 py-3">Month {role.start_month}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(role)}
                            className="p-1 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(role.id)}
                            className="p-1 text-red-600 hover:text-red-800 rounded hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
    </Card>
  )
}
--- END FILE: frontend/components/forms/StaffingForm.tsx ---
```

