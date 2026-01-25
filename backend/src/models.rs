use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{NaiveDate, DateTime, Utc};
use rust_decimal::Decimal;

// --- Phase 0: Multi-Tenancy & Auth ---

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Tenant {
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: Option<String>,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub full_name: String,
    pub tenant_id: Uuid,
    pub created_at: DateTime<Utc>,
}

// --- Phase 3: Portfolio Structure ---

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Fund {
    pub id: Uuid,
    pub user_id: Uuid,
    pub fund_name: String, // Renamed from name
    pub currency_code: String,
    pub created_at: DateTime<Utc>,
    pub tenant_id: Uuid,
    pub is_public_template: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Company {
    pub id: Uuid,
    pub fund_id: Uuid,
    // tenant_id removed from here to fix duplicate field error
    pub company_name: String, // Renamed from name
    pub currency_code: String,
    pub created_at: DateTime<Utc>,
    pub industry: Option<String>,
    pub business_model: Option<String>,
    pub technology: Option<String>,
    pub tenant_id: Uuid,
}

// Add New Struct for Exchange Rates
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ExchangeRate {
    pub id: Uuid,
    pub from_currency: String,
    pub to_currency: String,
    pub rate: Decimal,
    pub rate_month: NaiveDate,
    pub created_at: DateTime<Utc>,
    pub tenant_id: Uuid,
}

// --- Phase 1 & 2: Financial Models ---

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct FinancialPlan {
    pub id: Uuid,
    pub company_id: Uuid,
    pub plan_name: String, // Renamed from name
    pub start_month: NaiveDate,
    pub currency_code: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
    pub initial_cash: Decimal,
    pub pooling_fraction: Decimal, 
    pub tenant_id: Uuid,
    pub last_p50_net_value: Option<Decimal>,
    pub insolvency_threshold: Decimal,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct RevenueItem {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub revenue_name: String, // Renamed from name
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
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ExpenseItem {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub expense_name: String, // Renamed from name
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
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct CapitalInjection {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub injection_name: String, // Renamed from name
    pub amount: Decimal,
    pub month: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct DividendPolicy {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub is_enabled: bool,
    pub safety_threshold: Decimal,
    pub payout_ratio: Decimal,
    pub created_at: DateTime<Utc>,
    pub tracking_enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct CreditFacility {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub facility_limit: Decimal,
    pub interest_rate: Decimal,
    pub is_annual_rate: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ValuationAssumption {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub valuation_name: String,
    pub method: String,
    pub multiplier: Decimal,
    pub date_applied: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct EventShock {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub shock_name: String, // Renamed from event_name
    pub shock_month: i32,
    pub impact_type: String,
    pub impact_value: Decimal,
    pub duration_months: Option<i32>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
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
    pub created_at: Option<DateTime<Utc>>,
    pub growth_rate_percent: Decimal,
}

#[derive(Deserialize, Debug)]
pub struct CreateFundRequest {
    pub fund_name: String,
    pub currency_code: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct UpdateFundRequest {
    pub fund_name: String,
    pub currency_code: String,
}

#[derive(Deserialize, Debug)]
pub struct CreateCompanyRequest {
    pub fund_id: Uuid,
    pub tenant_id: Uuid,
    pub company_name: String,
    pub business_model: Option<String>,
    pub industry: Option<String>,
    pub technology: Option<String>,
    pub currency_code: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct UpdateCompanyRequest {
    pub company_name: String,
    pub business_model: Option<String>,
    pub industry: Option<String>,
    pub technology: Option<String>,
    pub currency_code: String,
}

// --- Point 9: Staffing & Payroll ---
#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct StaffingRole {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub role_name: String,
    pub annual_salary: Decimal,
    pub start_month: i32,
    pub target_count: i32, 
    pub hiring_plan: String, 
    pub hiring_rate: Option<i32>, 
    pub annual_increase_percent: Decimal,
    pub created_at: DateTime<Utc>,
}

// --- Auth DTOs ---

#[derive(Deserialize, Debug)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
    pub full_name: String,
    pub email: String,
}

#[derive(Deserialize, Debug)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize, Debug)]
pub struct AuthResponse {
    pub token: String,
    pub user_id: Uuid,
    pub username: String,
    pub tenant_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub user_id: Uuid,
    pub tenant_id: Uuid,
    pub exp: usize,
}

// --- Fund Plans ---

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FundPlan {
    pub id: Uuid,
    pub fund_id: Uuid,
    pub tenant_id: Uuid,
    pub plan_name: String,
    pub selected_plans: serde_json::Value, // Maps to JSONB
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFundPlanRequest {
    pub plan_name: String,
    pub selected_plans: serde_json::Value,
}

// --- Plan Requests ---

#[derive(Deserialize)]
pub struct CreatePlanRequest {
    pub company_id: Uuid,
    pub plan_name: String,
    pub start_month: String, // YYYY-MM-01
    pub currency_code: Option<String>,
    pub insolvency_threshold: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdatePlanRequest {
    pub plan_name: Option<String>,
    pub start_month: Option<String>,
    pub pooling_fraction: Option<Decimal>,
    pub initial_cash: Option<String>,
    pub insolvency_threshold: Option<String>,
}
