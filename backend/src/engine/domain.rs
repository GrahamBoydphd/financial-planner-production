use uuid::Uuid;
use serde::{Serialize, Deserialize};
pub use crate::distributions::GrowthSampler;
use rust_decimal::Decimal;
use crate::projection::MonthlyData;

// --- STRUCTS ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemState {
    pub current_value: f64,
    pub is_active: bool,
    pub has_fired: bool,
    pub active_phase_idx: Option<usize>,
}

impl Default for ItemState {
    fn default() -> Self {
        Self { 
            current_value: 0.0, 
            is_active: false,
            has_fired: false,
            active_phase_idx: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Phase {
    pub phase_sequence: i32,
    pub trigger_month: Option<i32>,
    // Using f64 for the hot path to maintain hardware-level speed per the Immutable Data Contract
    pub trigger_threshold: Option<f64>,
    pub trigger_operator: Option<String>,
    pub growth_rate: f64,
    pub variable_pct: Option<f64>,
    pub compounding_growth_sampler: Option<GrowthSampler>,
    pub transient_noise_sampler: Option<GrowthSampler>,
    pub baseline_increment: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Revenue {
    pub name: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: f64,
    pub frequency: String,
    pub trigger_strategy: String,
    pub trigger_threshold: Option<f64>,
    pub trigger_operator: Option<String>,
    pub phases: Vec<Phase>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Expense {
    pub name: String,
    pub category: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: f64,
    pub frequency: String,
    pub trigger_strategy: String,
    pub trigger_threshold: Option<f64>,
    pub trigger_operator: Option<String>,
    pub phases: Vec<Phase>,
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
    pub target_company_id: Option<Uuid>, // Added for routing stochastic shocks
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
    
    pub ytd_revenue: f64,
    
    // Soft Limit (Friction Tax)
    pub soft_limit_active: bool,
    pub soft_limit_threshold: f64,
    pub soft_limit_fraction: f64,

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

        let debt = self.current_cash.min(0.0).abs();
        let exposure = self.cum_external_cap + debt;

        // 2. Record Month 0 History
        self.history.push(MonthlyData {
            month_index: 0,
            date: "Month 0".to_string(),
            revenue: Decimal::ZERO,
            cogs: Decimal::ZERO,
            opex: Decimal::ZERO,
            gross_profit: Decimal::ZERO,
            net_income: Decimal::ZERO,
            treasury_gain: Decimal::ZERO,
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
            pool_contribution: Decimal::ZERO,
            pool_received: Decimal::ZERO,
            contributing_companies: 0,
            total_exposure: Decimal::from_f64_retain(exposure).unwrap_or_default(),
        });
    }

    pub fn force_insolvency_state(&mut self) {
        self.is_solvent = false;
        // Removed: self.current_cash = 0.0; 
        // We preserve the debt (negative cash) for Venture Debt visibility.
    }

    pub fn step(&mut self, month: i32, external_shocks: &[Shock]) -> (f64, f64) {
        // LOGIC A: Handle Insolvency
        if self.is_solvent == false {
            let debt = self.current_cash.min(0.0).abs();
            let exposure = self.cum_external_cap + debt;

            // Push "Erasure" (Zero) state but keep debt visible
            self.history.push(MonthlyData {
                month_index: month,
                date: format!("Month {}", month),
                revenue: Decimal::ZERO,
                cogs: Decimal::ZERO,
                opex: Decimal::ZERO,
                gross_profit: Decimal::ZERO,
                net_income: Decimal::ZERO,
                treasury_gain: Decimal::ZERO,
                // Use actual negative cash
                cash_balance: Decimal::from_f64_retain(self.current_cash).unwrap_or_default(),
                is_solvent: false,
                interest_expense: Decimal::ZERO,
                dividend_paid: Decimal::ZERO,
                cumulative_dividends: Decimal::from_f64_retain(self.cum_dividends).unwrap_or_default(),
                cumulative_external_capital: Decimal::from_f64_retain(self.cum_external_cap).unwrap_or_default(),
                cumulative_pool_received: Decimal::from_f64_retain(self.cum_pool_received).unwrap_or_default(),
                // Total value reflects debt
                total_value: Decimal::from_f64_retain(self.current_cash + self.cum_dividends).unwrap_or_default(),
                total_companies: 1,
                solvent_companies: 0,
                pool_contribution: Decimal::ZERO,
                pool_received: Decimal::ZERO,
                contributing_companies: 0,
                total_exposure: Decimal::from_f64_retain(exposure).unwrap_or_default(),
            });
            return (0.0, 0.0);
        }

        // LOGIC B: Calculate Pooling Base (Start of active step)
        let previous_cash_floored = self.current_cash.max(0.0);

        if (month - 1) % 12 == 0 {
            self.ytd_revenue = 0.0;
        }

        // Merge External Shocks (Persist them in state)
        self.shocks.extend_from_slice(external_shocks);
        self.shocks.retain(|s| month < s.month + s.duration_months.unwrap_or(1));

        let mut monthly_rev = 0.0;
        let mut monthly_cogs = 0.0;
        let mut monthly_opex = 0.0;
        let mut monthly_interest = 0.0;

        // 1. Revenue
        for (i, item) in self.revenues.iter_mut().enumerate() {
            let s = &mut self.revenue_states[i];
            
            if month == item.start_month {
                s.is_active = true;
                s.current_value = item.initial_amount;
            } else if let Some(end) = item.end_month {
                if month > end { s.is_active = false; }
            }

            if s.is_active {
                let is_one_time = item.frequency.eq_ignore_ascii_case("one_time") || item.frequency.eq_ignore_ascii_case("one-time");
                if is_one_time && s.has_fired { continue; }
                
                let mut active_idx: Option<usize> = None;
                for (p_idx, phase) in item.phases.iter().enumerate() {
                    let is_active = match item.trigger_strategy.as_str() {
                        "time_based" => {
                            if let Some(tm) = phase.trigger_month {
                                month >= tm
                            } else {
                                true
                            }
                        },
                        "value_based" => {
                            if let (Some(thresh), Some(op)) = (phase.trigger_threshold, phase.trigger_operator.as_deref()) {
                                match op {
                                    "greater_than" => s.current_value > thresh,
                                    "less_than" => s.current_value < thresh,
                                    _ => false,
                                }
                            } else {
                                phase.trigger_threshold.is_none() && phase.trigger_operator.is_none()
                            }
                        },
                        _ => false,
                    };
                    if is_active {
                        if let Some(curr_idx) = active_idx {
                            if phase.phase_sequence > item.phases[curr_idx].phase_sequence {
                                active_idx = Some(p_idx);
                            }
                        } else {
                            active_idx = Some(p_idx);
                        }
                    }
                }

                if let Some(idx) = active_idx {
                    let phase = &mut item.phases[idx];
                    
                    if s.active_phase_idx == Some(idx) {
                    } else {
                        s.current_value += phase.baseline_increment.unwrap_or(0.0);
                        s.active_phase_idx = Some(idx);
                    }
                    
                    if month > item.start_month {
                        let should_grow = match item.frequency.as_str() {
                            "monthly" | "Monthly" => true,
                            "quarterly" | "Quarterly" => (month - item.start_month) % 3 == 0,
                            "annually" | "Annually" | "annual" | "Annual" => (month - item.start_month) % 12 == 0,
                            _ => true,
                        };
                        if should_grow {
                            let mut step_growth = phase.growth_rate;
                            if let Some(sampler) = &mut phase.compounding_growth_sampler {
                                step_growth += sampler.sample() / 100.0;
                            }
                            s.current_value *= 1.0 + step_growth;
                        }
                    }
                    
                    let mut item_rev = s.current_value;
                    if let Some(sampler) = &mut phase.transient_noise_sampler {
                        item_rev *= 1.0 + sampler.sample() / 100.0;
                    }
                    
                    monthly_rev += item_rev;
                    monthly_cogs += item_rev * phase.variable_pct.unwrap_or(0.0);
                    
                    if is_one_time {
                        s.has_fired = true;
                    }
                } else if item.phases.is_empty() {
                    monthly_rev += s.current_value;
                    if is_one_time {
                        s.has_fired = true;
                    }
                }
            }
        }

        self.ytd_revenue += monthly_rev;

        // 2. Expenses
        for (i, item) in self.expenses.iter_mut().enumerate() {
            let s = &mut self.expense_states[i];
            
            if month == item.start_month {
                s.is_active = true;
                s.current_value = item.initial_amount;
            } else if let Some(end) = item.end_month {
                if month > end { s.is_active = false; }
            }

            if s.is_active {
                let is_one_time = item.frequency.eq_ignore_ascii_case("one_time") || item.frequency.eq_ignore_ascii_case("one-time");
                if is_one_time && s.has_fired { continue; }
                
                let mut active_idx: Option<usize> = None;
                for (p_idx, phase) in item.phases.iter().enumerate() {
                    let is_active = match item.trigger_strategy.as_str() {
                        "time_based" => {
                            if let Some(tm) = phase.trigger_month {
                                month >= tm
                            } else {
                                true
                            }
                        },
                        "value_based" => {
                            if let (Some(thresh), Some(op)) = (phase.trigger_threshold, phase.trigger_operator.as_deref()) {
                                match op {
                                    "greater_than" => monthly_rev > thresh,
                                    "less_than" => monthly_rev < thresh,
                                    "ytd_revenue_greater_than" => self.ytd_revenue > thresh,
                                    _ => false,
                                }
                            } else {
                                phase.trigger_threshold.is_none() && phase.trigger_operator.is_none()
                            }
                        },
                        _ => false,
                    };
                    if is_active {
                        if let Some(curr_idx) = active_idx {
                            if phase.phase_sequence > item.phases[curr_idx].phase_sequence {
                                active_idx = Some(p_idx);
                            }
                        } else {
                            active_idx = Some(p_idx);
                        }
                    }
                }

                if let Some(idx) = active_idx {
                    let phase = &mut item.phases[idx];
                    
                    if s.active_phase_idx == Some(idx) {
                    } else {
                        s.current_value += phase.baseline_increment.unwrap_or(0.0);
                        s.active_phase_idx = Some(idx);
                    }
                    
                    if month > item.start_month {
                        let should_grow = match item.frequency.as_str() {
                            "monthly" | "Monthly" => true,
                            "quarterly" | "Quarterly" => (month - item.start_month) % 3 == 0,
                            "annually" | "Annually" | "annual" | "Annual" => (month - item.start_month) % 12 == 0,
                            _ => true,
                        };
                        if should_grow {
                            let mut step_growth = phase.growth_rate;
                            if let Some(sampler) = &mut phase.compounding_growth_sampler {
                                step_growth += sampler.sample() / 100.0;
                            }
                            s.current_value *= 1.0 + step_growth;
                        }
                    }
                    
                    let mut amt = s.current_value;
                    if let Some(sampler) = &mut phase.transient_noise_sampler {
                        amt *= 1.0 + sampler.sample() / 100.0;
                    }
                    
                    if let Some(pct) = phase.variable_pct {
                        amt += monthly_rev * pct;
                    }
                    monthly_opex += amt;
                    
                    if is_one_time {
                        s.has_fired = true;
                    }
                } else if item.phases.is_empty() {
                    monthly_opex += s.current_value;
                    if is_one_time {
                        s.has_fired = true;
                    }
                }
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

        // 4. Apply Active Shocks
        let mut capital_growth_mult = 1.0;
        for shock in &self.shocks {
            let duration = shock.duration_months.unwrap_or(1);
            if month >= shock.month && month < shock.month + duration {
                
                let monthly_raw_pct = (shock.impact_value / 100.0) / duration as f64;
                
                // Updated is_expense check to include "expense_shock"
                let is_expense = matches!(shock.impact_type.as_str(), "expense" | "opex" | "cogs" | "expense_shock");
                
                let mult = if is_expense { 1.0 - monthly_raw_pct } else { 1.0 + monthly_raw_pct };
                let mult = mult.max(0.0);
                
                match shock.impact_type.as_str() {
                    "revenue" | "revenue_shock" => { 
                        monthly_rev *= mult; 
                        monthly_cogs *= mult; 
                    },
                    "expense" | "opex" | "expense_shock" => {
                        monthly_opex *= mult;
                    },
                    "cogs" => monthly_cogs *= mult,
                    "cash" | "cash_shock" => {
                        // Apply fractionally to absolute cash to avoid debt bailouts
                        let cash_impact = self.current_cash.abs() * monthly_raw_pct;
                        if is_expense {
                            self.current_cash -= cash_impact; // Detrimental: drains cash / increases debt
                        } else {
                            self.current_cash += cash_impact; // Beneficial: adds cash / shrinks debt
                        }
                    },
                    "valuation" | "valuation_shock" => {
                        // Valuation shocks do not affect operational cash flow or cash balance directly.
                        // They affect the theoretical equity value, which is calculated downstream or in aggregation.
                    },
                    "capital_growth" | "capital_growth_shock" => {
                        capital_growth_mult *= (1.0 + monthly_raw_pct).max(0.0);
                    },
                    _ => {}
                }
            }
        }

        // 5. Interest on Credit Facility (New Logic)
        if self.current_cash < 0.0 {
            if let Some(cf) = &self.credit_facility {
                let debt = self.current_cash.abs();
                let rate = if cf.is_annual_rate { cf.interest_rate / 12.0 } else { cf.interest_rate };
                monthly_interest = debt * rate;
            }
        }

        // 6. Injections
        for injection in &self.injections {
            if month == injection.month {
                self.current_cash += injection.amount;
                self.cum_external_cap += injection.amount;
            }
        }

        let gross_profit = monthly_rev - monthly_cogs;
        let total_expenses = monthly_opex + monthly_interest;
        let operating_profit = gross_profit - total_expenses;

        // 7. Update Cash
        self.current_cash += operating_profit;

        // 8. Investment Gain (Treasury)
        let mut investment_gain = 0.0;
        if self.current_cash > 0.0 {
            if let Some(policy) = &self.capital_growth {
                if let Some(sampler) = &mut self.cap_growth_sampler {
                    let rate = sampler.sample();
                    let effective_rate = ((policy.growth_rate * 100.0 + rate) / 100.0) * capital_growth_mult;
                    investment_gain = self.current_cash * effective_rate;
                }
            }
        }
        self.current_cash += investment_gain;

        // LOGIC C: Apply Pooling (Ergodicity Correction)
        // 9. Pooling Contribution (Refined)
        let total_profit = operating_profit + investment_gain; // Kept for net_income reporting
        
        let current_cash_floored = self.current_cash.max(0.0);
        let poolable_gain = current_cash_floored - previous_cash_floored;
        
        let mut contribution = 0.0;
        // VERIFIED: Uses self.pooling_fraction which is overridden by Orchestrator if ergodicity_correction is set.
        if self.pooling_fraction > 0.0 && poolable_gain > 0.0 {
            contribution = poolable_gain * self.pooling_fraction;
            self.current_cash -= contribution;
        }

        // LOGIC D: Soft Upper Limit (Friction Tax)
        if self.soft_limit_active && self.current_cash > self.soft_limit_threshold {
            let excess = self.current_cash - self.soft_limit_threshold;
            let tax = excess * self.soft_limit_fraction;
            self.current_cash -= tax;
        }

        let net_income = total_profit;

        let debt = self.current_cash.min(0.0).abs();
        let exposure = self.cum_external_cap + debt;

        // Record History
        self.history.push(MonthlyData {
            month_index: month,
            date: format!("Month {}", month),
            revenue: Decimal::from_f64_retain(monthly_rev).unwrap_or_default(),
            cogs: Decimal::from_f64_retain(monthly_cogs).unwrap_or_default(),
            opex: Decimal::from_f64_retain(monthly_opex).unwrap_or_default(),
            gross_profit: Decimal::from_f64_retain(gross_profit).unwrap_or_default(),
            net_income: Decimal::from_f64_retain(net_income).unwrap_or_default(),
            treasury_gain: Decimal::from_f64_retain(investment_gain).unwrap_or_default(),
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
            pool_contribution: Decimal::from_f64_retain(contribution).unwrap_or_default(),
            pool_received: Decimal::ZERO, // Will be updated by orchestrator if pooling happens
            contributing_companies: if contribution > 0.0 { 1 } else { 0 },
            total_exposure: Decimal::from_f64_retain(exposure).unwrap_or_default(),
        });

        (net_income, contribution)
    }
}
