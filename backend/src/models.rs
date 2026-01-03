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
