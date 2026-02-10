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
        if !self.is_solvent {
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

        // Merge External Shocks (Persist them in state)
        self.shocks.extend_from_slice(external_shocks);

        let mut monthly_rev = 0.0;
        let mut monthly_cogs = 0.0;
        let mut monthly_opex = 0.0;
        let mut monthly_interest = 0.0;

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

        // 4. Apply Active Shocks
        for shock in &self.shocks {
            let duration = shock.duration_months.unwrap_or(1);
            if month >= shock.month && month < shock.month + duration {
                
                let raw_pct = shock.impact_value / 100.0;
                
                // Updated is_expense check to include "expense_shock"
                let is_expense = matches!(shock.impact_type.as_str(), "expense" | "opex" | "cogs" | "expense_shock");
                
                let mult = if is_expense { 1.0 - raw_pct } else { 1.0 + raw_pct };
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
                        self.current_cash *= mult;
                    },
                    "valuation" | "valuation_shock" => {
                        // Valuation shocks do not affect operational cash flow or cash balance directly.
                        // They affect the theoretical equity value, which is calculated downstream or in aggregation.
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
                    let effective_rate = (policy.growth_rate * 100.0 + rate) / 100.0;
                    investment_gain = self.current_cash * effective_rate;
                }
            }
        }
        self.current_cash += investment_gain;

        // LOGIC C: Apply Pooling
        // 9. Pooling Contribution (Refined)
        let total_profit = operating_profit + investment_gain; // Kept for net_income reporting
        
        let current_cash_floored = self.current_cash.max(0.0);
        let poolable_gain = current_cash_floored - previous_cash_floored;
        
        let mut contribution = 0.0;
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
