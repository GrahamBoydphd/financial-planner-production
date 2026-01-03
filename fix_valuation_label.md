🤖 Connecting to gemini-3-pro-preview (Paid Tier)...
Based on the task instructions, I will modify the backend to return the valuation method used in the simulation, update the frontend API interface, and ensure the UI reflects this method in the KPI cards.

Here are the updated files:

1.  **`backend/src/projection.rs`**: Added `valuation_method` to `SimulationResult` struct and populated it in `generate_simulation`.
2.  **`frontend/lib/api.ts`**: Added `valuation_method` to `SimulationResult` interface.
3.  **`frontend/app/plan/[planId]/results/page.tsx`**: Updated `useEffect` to set `valuationMethod` state from the projection result.

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
--- END FILE: backend/src/projection.rs ---

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

export interface ValuationAssumption {
  id: string;
  plan_id: string;
  name: string;
  method: 'revenue' | 'ebitda';
  multiplier: number;
  date_applied: string;
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
  valuation_method: string;
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
  getValuation: async (planId: string) => 
    (await axios.get<ValuationAssumption[]>(`${API_URL}/api/plans/${planId}/valuation`)).data,
  createValuation: async (item: { plan_id: string, name: string, method: string, multiplier: number, date_applied: string }) => 
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

--- START FILE: frontend/app/plan/[planId]/results/page.tsx ---
'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import CashFlowChart from '@/components/CashFlowChart';
import Button from '@/components/ui/Button';
import { api, FinancialPlan, CapitalInjection, DividendPolicy, CreditFacility, ValuationAssumption } from '@/lib/api';

// --- COMPONENT: KPI CARDS ---
interface KPIProps {
  simMode: string;
  projection: any;
  creditLimit: string;
  stopInsolvency: boolean;
  currency: string;
  valuationMethod: string;
}

const KPICards = ({ simMode, projection, creditLimit, stopInsolvency, currency, valuationMethod }: KPIProps) => {
    if (!projection) return null;

    // Helper to format with currency
    const fmt = (n: any) => 
        `${currency}${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    const lastData = projection.deterministic_data?.[projection.deterministic_data.length - 1] || {};
    const singleLastData = projection.single_run_data?.[projection.single_run_data.length - 1] || lastData;

    let totalVal = lastData.total_value;
    let valuation = projection.deterministic_valuation;
    let subtitle = 'Deterministic Average';
    let insolvencyMonth = -1;
    let runwayVal: number | string = 'Infinite';

    const checkInsolvency = (dataArray: any[]) => {
        if (!dataArray) return -1;
        const idx = dataArray.findIndex(m => m.is_insolvent || Number(m.cash_balance) < -(Number(creditLimit) || 0));
        return idx !== -1 ? dataArray[idx].month_index : -1;
    };

    // RUNWAY CALCULATION HELPER
    const calculateRunway = (cash: number, netIncome: number) => {
        if (netIncome >= 0) return 'Infinite';
        const burn = -netIncome;
        const available = cash + Number(creditLimit);
        if (available <= 0) return 0;
        return Math.floor(available / burn);
    };

    if (simMode === 'single') {
        totalVal = singleLastData.total_value;
        valuation = projection.single_run_valuation;
        subtitle = 'Single Run Result';
        if (projection.single_run_data) {
            insolvencyMonth = checkInsolvency(projection.single_run_data);
            runwayVal = calculateRunway(Number(singleLastData.cash_balance), Number(singleLastData.net_income));
        }
    } else if (simMode === 'monte_carlo') {
        totalVal = projection.p50_value?.[projection.p50_value.length - 1] || 0;
        valuation = projection.p50_valuation;
        subtitle = 'Median (P50)';
        runwayVal = projection.p50_runway ?? 'Infinite';
        
    } else {
        // Standard
        insolvencyMonth = checkInsolvency(projection.deterministic_data);
        runwayVal = calculateRunway(Number(lastData.cash_balance), Number(lastData.net_income));
    }

    const p90Val = projection.p90_value?.[projection.p90_value.length - 1] || 0;

    return (
      <>
        <Card className="text-center border-b-4 border-gray-500 mb-4">
          <h3 className="text-gray-500 text-xs uppercase font-bold">Net Value (Cash+Divs)</h3>
          <p className={`text-2xl font-bold ${totalVal < 0 ? 'text-red-600' : 'text-gray-700'}`}>
            {fmt(totalVal)}
          </p>
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        </Card>

        {simMode === 'monte_carlo' && (
          <Card className="text-center border-b-4 border-blue-600 mb-4">
            <h3 className="text-blue-700 text-xs uppercase font-bold">Upside (P90)</h3>
            <p className={`text-2xl font-bold ${p90Val < 0 ? 'text-red-600' : 'text-blue-700'}`}>
              {fmt(p90Val)}
            </p>
          </Card>
        )}

        <Card className="text-center mb-4">
            <h3 className="text-gray-500 text-sm uppercase">Valuation (Est)</h3>
            <p className="text-2xl font-bold text-green-600">{fmt(valuation)}</p>
            <p className="text-xs text-gray-400 mt-1">
                {valuationMethod === 'ebitda' ? 'Based on EBITDA' : 'Based on Final Revenue'}
            </p>
        </Card>
        
        <Card className="text-center mb-4">
            <h3 className="text-gray-500 text-sm uppercase">
                {simMode === 'monte_carlo' ? 'Runway (Median, P50)' : 'Runway'}
            </h3>
            {insolvencyMonth !== -1 ? (
                <div className="text-red-600">
                    <p className="text-xl font-bold">Insolvent in Month {insolvencyMonth}</p>
                    <p className="text-xs mt-1">
                        {stopInsolvency ? 'Trading Stopped' : 'Showing fantasy projection'}
                    </p>
                </div>
            ) : runwayVal === 0 ? (
                <p className="text-2xl font-bold text-red-600">Insolvent (0 Mo)</p>
            ) : runwayVal !== 'Infinite' ? (
                <p className="text-2xl font-bold text-purple-600">{runwayVal} Mo</p>
            ) : (
                <p className="text-2xl font-bold text-purple-600">Infinite</p>
            )}
        </Card>
      </>
    );
};

// --- MAIN PAGE COMPONENT ---
export default function ResultsPage({ params }: { params: { planId: string } }) {
  const { planId } = params;
  const [plan, setPlan] = useState<FinancialPlan | null>(null);
  const [projection, setProjection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
   
  // Financial State
  const [capitalItems, setCapitalItems] = useState<CapitalInjection[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dividendPolicy, setDividendPolicy] = useState<DividendPolicy | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [creditFacility, setCreditFacility] = useState<CreditFacility | null>(null);
   
  // Forms State
  const [newCapName, setNewCapName] = useState('');
  const [newCapAmount, setNewCapAmount] = useState('');
  const [newCapMonth, setNewCapMonth] = useState('');

  const [divEnabled, setDivEnabled] = useState(false);
  const [divThreshold, setDivThreshold] = useState('50000');
  const [divRatio, setDivRatio] = useState('20');

  const [creditLimit, setCreditLimit] = useState('0');
  const [creditRate, setCreditRate] = useState('10');
  const [creditIsAnnual, setCreditIsAnnual] = useState(true);

  const [valMultiple, setValMultiple] = useState('5'); 
  const [valuationMethod, setValuationMethod] = useState('revenue');

  // Controls
  const [years, setYears] = useState(5);
  const [isLogScale, setIsLogScale] = useState(true); // Default Log Scale
  const [simMode, setSimMode] = useState<'single' | 'monte_carlo' | 'standard'>('standard');
  const [stopInsolvency, setStopInsolvency] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // UI Settings
  const [currency, setCurrency] = useState(''); // Default None

  // --- 1. DATA LOADING ---
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const p = await api.getPlan(planId);
        setPlan(p);
        
        const caps = await api.getCapitalInjections(planId);
        setCapitalItems(caps);
        
        try {
          const div = await api.getDividends(planId);
          setDividendPolicy(div);
          setDivEnabled(div.is_enabled);
          setDivThreshold(div.safety_threshold.toString());
          setDivRatio(div.payout_ratio.toString());
        } catch { /* No policy set */ }

        try {
          const cred = await api.getCredit(planId);
          setCreditFacility(cred);
          setCreditLimit(cred.facility_limit.toString());
          setCreditRate(cred.interest_rate.toString());
          setCreditIsAnnual(cred.is_annual_rate);
        } catch { /* No credit set */ }

        try {
          const vals = await api.getValuation(planId);
          if (vals && vals.length > 0) {
             const latest = vals[vals.length - 1];
             setValMultiple(latest.multiplier.toString());
             setValuationMethod(latest.method);
          }
        } catch { /* No valuation set */ }

        // Use standard or monte_carlo depending on UI
        const backendMode = simMode === 'monte_carlo' ? 'monte_carlo' : 'single';
        const proj = await api.getProjection(planId, {
           mode: backendMode,
           stop_insolvency: stopInsolvency,
           initial_cash: p.initial_cash, // Pass initial cash from plan
           months: years * 12 // FIX: Pass months based on years selector
        });

        if (proj.valuation_method) {
            setValuationMethod(proj.valuation_method);
        }
        
        // --- DATA MAPPING FOR TABLE ---
        let sourceData = proj.deterministic_data;
        if (backendMode === 'single' && proj.single_run_data) {
           sourceData = proj.single_run_data;
        }

        const tableData = sourceData.map((m: any) => ({
           month_index: m.month_index,
           date: m.date,
           revenue: m.revenue,
           cogs: m.cogs,
           gross_profit: m.gross_profit,
           opex: m.opex,
           net_income: m.net_income,
           cash_balance: m.cash_balance,
           total_value: m.total_value, 
           dividend_paid: m.dividend_paid,
           is_insolvent: m.is_insolvent
        }));
        
        (proj as any).cash_flow_data = tableData;
        setProjection(proj);

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [planId, years, simMode, stopInsolvency, refreshTrigger]); 

  // --- 2. HANDLERS ---
  const handleAddCapital = async () => {
    if (!newCapName || !newCapAmount) return;
    await api.createCapitalInjection({
      plan_id: planId,
      name: newCapName,
      amount: Number(newCapAmount),
      month: Number(newCapMonth || 0)
    });
    setNewCapName(''); setNewCapAmount(''); setNewCapMonth('');
    setRefreshTrigger(n => n + 1);
  };

  const handleDeleteCapital = async (id: string) => {
    await api.deleteCapitalInjection(id);
    setRefreshTrigger(n => n + 1);
  };

  const handleSaveDividends = async () => {
    await api.upsertDividends({
      plan_id: planId,
      is_enabled: divEnabled,
      safety_threshold: Number(divThreshold),
      payout_ratio: Number(divRatio)
    });
    setRefreshTrigger(n => n + 1);
  };

  const handleSaveCredit = async () => {
    await api.upsertCredit({
      plan_id: planId,
      facility_limit: Number(creditLimit),
      interest_rate: Number(creditRate),
      is_annual_rate: creditIsAnnual
    });
    setRefreshTrigger(n => n + 1);
  };

  const handleSaveValuation = async () => {
    await api.createValuation({
      plan_id: planId,
      name: 'Valuation',
      method: valuationMethod,
      multiplier: Number(valMultiple),
      date_applied: new Date().toISOString().split('T')[0] // Fix 422
    });
    setRefreshTrigger(n => n + 1);
  };

  // Helper
  const fmt = (n: any) => 
    `${currency}${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  if (!plan) return <Layout>Loading...</Layout>;

  return (
    <Layout>
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">{plan.name} - Projections</h1>
          <p className="text-gray-500">Financial Simulation Engine v2.0</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
            <div className="bg-white p-2 rounded shadow flex items-center gap-4">
              <select 
                className="border rounded p-1 text-sm bg-white"
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
              >
                {[1, 2, 3, 5, 10, 20, 50, 100].map(y => <option key={y} value={y}>{y} Years</option>)}
              </select>

              <div className="flex items-center gap-2 border-l pl-4">
                <input 
                  type="checkbox" id="logScale" 
                  checked={isLogScale} onChange={(e) => setIsLogScale(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <label htmlFor="logScale" className="text-sm font-medium cursor-pointer">Log Scale</label>
              </div>

              <div className="flex items-center gap-2 border-l pl-4">
                <select 
                  className="border rounded p-1 text-sm font-bold text-blue-800 bg-blue-50"
                  value={simMode}
                  onChange={(e) => setSimMode(e.target.value as any)}
                >
                  <option value="standard">Standard (Average)</option>
                  <option value="single">Single Path (Volatile)</option>
                  <option value="monte_carlo">Monte Carlo (1000 Runs)</option>
                </select>
              </div>

              {/* Currency Selector */}
              <div className="flex items-center gap-2 border-l pl-4">
                  <span className="text-xs text-gray-500">Currency:</span>
                  <select 
                    className="border rounded p-1 text-sm font-bold"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                      <option value="">None</option>
                      <option value="$">$</option>
                      <option value="€">€</option>
                      <option value="£">£</option>
                      <option value="¥">¥</option>
                  </select>
              </div>

              {/* Insolvency Checkbox */}
              <div className="flex items-center gap-2 border-l pl-4">
                <input 
                  type="checkbox" id="stopInsolvency" 
                  checked={stopInsolvency} onChange={(e) => setStopInsolvency(e.target.checked)}
                  className="rounded text-red-600"
                />
                <label htmlFor="stopInsolvency" className="text-sm font-medium cursor-pointer text-red-800">Stop on Insolvency</label>
              </div>
            </div>

            <div className="flex gap-2">
              {simMode === 'single' && (
                 <Button variant="secondary" onClick={() => setRefreshTrigger(n => n + 1)}>Recalculate 🎲</Button>
              )}
              <a href={`/plan/${planId}/inputs`} className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 font-medium">Edit Revenue/Cost</a>
            </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 animate-pulse text-blue-600 font-medium">Running Simulation...</div>
      ) : projection && (
        <div className="space-y-8">
          
          {simMode === 'single' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-700">Deterministic (Average)</h2>
                </div>
                <div className="h-80">
                  <CashFlowChart 
                    data={projection} 
                    isLog={isLogScale} 
                    mode="standard" 
                    creditLimit={Number(creditLimit)}
                    currencySymbol={currency}
                  />
                </div>
              </Card>
              <Card>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-blue-700">Volatile (Single Run)</h2>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Stochastic</span>
                </div>
                <div className="h-80">
                  <CashFlowChart 
                    data={projection} 
                    isLog={isLogScale} 
                    mode="single" 
                    creditLimit={Number(creditLimit)}
                    currencySymbol={currency}
                  />
                </div>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-grow">
                <Card className="h-full">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">Total Value Forecast</h2>
                    {simMode === 'monte_carlo' && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Fan Chart Active</span>}
                  </div>
                  <div className="h-96">
                    <CashFlowChart 
                      data={projection} 
                      isLog={isLogScale} 
                      mode={simMode} 
                      creditLimit={Number(creditLimit)}
                      currencySymbol={currency}
                    />
                  </div>
                </Card>
              </div>
              <div className="w-full lg:w-64 flex-shrink-0">
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                   <KPICards simMode={simMode} projection={projection} creditLimit={creditLimit} stopInsolvency={stopInsolvency} currency={currency} valuationMethod={valuationMethod} />
                </div>
              </div>
            </div>
          )}

          {simMode === 'single' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <KPICards simMode={simMode} projection={projection} creditLimit={creditLimit} stopInsolvency={stopInsolvency} currency={currency} valuationMethod={valuationMethod} />
            </div>
          )}

          {/* --- INLINED GRID TO FIX FOCUS LOSS --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <Card>
              <h3 className="text-md font-bold text-gray-800 mb-4 border-b pb-2">Valuation Model</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block">
                    {valuationMethod === 'ebitda' ? 'EBITDA Multiple (x)' : 'Revenue Multiple (x)'}
                  </label>
                  <input type="number" step="0.1" className="border p-1 w-full text-sm rounded" 
                    value={valMultiple} onChange={e => setValMultiple(e.target.value)} 
                    placeholder="e.g. 5.0"
                  />
                </div>
                <div className="text-xs text-gray-400 italic">
                  Valuation = Annual {valuationMethod === 'ebitda' ? 'EBITDA' : 'Revenue'} × Multiple
                </div>
                <button onClick={handleSaveValuation} className="w-full bg-blue-600 text-white text-sm py-1 rounded">Set Valuation</button>
              </div>
            </Card>

            <Card>
              <h3 className="text-md font-bold text-gray-800 mb-4 border-b pb-2">Capital Stack</h3>
              <div className="space-y-2 mb-4 h-24 overflow-y-auto">
                {capitalItems.length === 0 && <p className="text-sm text-gray-400 italic">No external capital.</p>}
                {capitalItems.map(c => (
                  <div key={c.id} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                    <div>
                      <span className="font-bold block">{c.name}</span>
                      <span className="text-xs text-gray-500">Month {c.month}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-green-700">{fmt(c.amount)}</span>
                      <button onClick={() => handleDeleteCapital(c.id)} className="text-red-400 hover:text-red-600">×</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Name" className="border p-1 text-xs rounded col-span-2" 
                  value={newCapName} onChange={e => setNewCapName(e.target.value)} />
                <input type="number" placeholder="$" className="border p-1 text-xs rounded" 
                  value={newCapAmount} onChange={e => setNewCapAmount(e.target.value)} />
                <input type="number" placeholder="Mo" className="border p-1 text-xs rounded" 
                  value={newCapMonth} onChange={e => setNewCapMonth(e.target.value)} />
                <button onClick={handleAddCapital} className="bg-gray-700 text-white text-xs py-1 rounded col-span-2">Add</button>
              </div>
            </Card>

            <Card>
              <h3 className="text-md font-bold text-gray-800 mb-4 border-b pb-2">Dividend Policy</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Enable?</label>
                  <input type="checkbox" checked={divEnabled} onChange={e => setDivEnabled(e.target.checked)} className="h-4 w-4" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block">Safety Threshold ($)</label>
                  <input type="number" className="border p-1 w-full text-sm rounded" 
                    value={divThreshold} onChange={e => setDivThreshold(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block">Payout Ratio (%)</label>
                  <input type="number" className="border p-1 w-full text-sm rounded" 
                    value={divRatio} onChange={e => setDivRatio(e.target.value)} />
                </div>
                <button onClick={handleSaveDividends} className="w-full bg-green-600 text-white text-sm py-1 rounded">Update</button>
              </div>
            </Card>

            <Card>
              <h3 className="text-md font-bold text-gray-800 mb-4 border-b pb-2">Credit / Overdraft</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block">Limit ($)</label>
                  <input type="number" className="border p-1 w-full text-sm rounded" 
                    value={creditLimit} onChange={e => setCreditLimit(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block">Rate (%)</label>
                  <input type="number" className="border p-1 w-full text-sm rounded" 
                    value={creditRate} onChange={e => setCreditRate(e.target.value)} />
                </div>
                <div className="flex gap-2 text-xs">
                  <label className="flex items-center gap-1">
                    <input type="radio" checked={creditIsAnnual} onChange={() => setCreditIsAnnual(true)} /> Annual
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="radio" checked={!creditIsAnnual} onChange={() => setCreditIsAnnual(false)} /> Monthly
                  </label>
                </div>
                <button onClick={handleSaveCredit} className="w-full bg-purple-600 text-white text-sm py-1 rounded">Set</button>
              </div>
            </Card>
          </div>

          <Card className="overflow-x-auto max-h-96">
            <table className="min-w-full text-xs text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Revenue</th>
                  <th className="px-4 py-3">Gross Profit</th>
                  <th className="px-4 py-3">OpEx</th>
                  <th className="px-4 py-3">Net Income</th>
                  <th className="px-4 py-3 text-gray-900 font-bold">Cash Bal</th>
                  <th className="px-4 py-3 text-green-600">Dividends</th>
                  <th className="px-4 py-3 text-blue-700 font-bold">Net Value</th>
                </tr>
              </thead>
              <tbody>
                {(projection as any).cash_flow_data.map((row: any) => (
                  <tr key={row.month_index} className={`border-b hover:bg-gray-50 ${row.is_insolvent ? 'bg-red-50' : 'bg-white'}`}>
                    <td className="px-4 py-2 font-medium">{row.month_index}</td>
                    <td className="px-4 py-2">{fmt(row.revenue)}</td>
                    <td className="px-4 py-2">{fmt(row.gross_profit)}</td>
                    <td className="px-4 py-2">{fmt(row.opex)}</td>
                    <td className={`px-4 py-2 ${row.net_income < 0 ? 'text-red-500' : 'text-green-600'}`}>{fmt(row.net_income)}</td>
                    <td className={`px-4 py-2 font-bold ${row.cash_balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>{fmt(row.cash_balance)}</td>
                    <td className="px-4 py-2 text-green-600">{row.dividend_paid > 0 ? fmt(row.dividend_paid) : '-'}</td>
                    <td className={`px-4 py-2 font-bold ${row.total_value < 0 ? 'text-red-600' : 'text-blue-700'}`}>
                      {fmt(row.total_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </Layout>
  );
}
--- END FILE: frontend/app/plan/[planId]/results/page.tsx ---

