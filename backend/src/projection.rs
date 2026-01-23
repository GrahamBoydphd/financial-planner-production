use serde::{Deserialize, Serialize};
use rust_decimal::Decimal;
use rust_decimal::prelude::*;

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
    pub total_companies: i32,
    pub solvent_companies: i32,
}

impl MonthlyData {
    pub fn new_empty(month: i32) -> Self {
        Self {
            month_index: month,
            date: format!("Month {}", month),
            revenue: Decimal::ZERO,
            cogs: Decimal::ZERO,
            gross_profit: Decimal::ZERO,
            opex: Decimal::ZERO,
            interest_expense: Decimal::ZERO,
            net_income: Decimal::ZERO,
            cash_balance: Decimal::ZERO,
            dividend_paid: Decimal::ZERO,
            cumulative_dividends: Decimal::ZERO,
            cumulative_external_capital: Decimal::ZERO,
            cumulative_pool_received: Decimal::ZERO,
            total_value: Decimal::ZERO,
            is_solvent: true,
            total_companies: 1,
            solvent_companies: 1,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

    pub p0_solvent_count: Vec<i32>,
    pub p10_solvent_count: Vec<i32>,
    pub p25_solvent_count: Vec<i32>,
    pub p50_solvent_count: Vec<i32>,
    pub p75_solvent_count: Vec<i32>,
    pub p90_solvent_count: Vec<i32>,
    pub p100_solvent_count: Vec<i32>,
    
    pub all_paths: Option<Vec<Vec<MonthlyData>>>,
    
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
