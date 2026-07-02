use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use crate::models::Claims;
use crate::errors::AppError;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use std::str::FromStr;

trait UnwrapOrZero {
    fn unwrap_or_zero(self) -> i32;
}
impl UnwrapOrZero for i32 {
    fn unwrap_or_zero(self) -> i32 { self }
}
impl UnwrapOrZero for Option<i32> {
    fn unwrap_or_zero(self) -> i32 { self.unwrap_or(0) }
}

trait ToDecimal {
    fn to_decimal(&self) -> Decimal;
}
impl ToDecimal for String {
    fn to_decimal(&self) -> Decimal { Decimal::from_str(self).unwrap_or(Decimal::ZERO) }
}
impl ToDecimal for Option<String> {
    fn to_decimal(&self) -> Decimal { self.as_deref().and_then(|s| Decimal::from_str(s).ok()).unwrap_or(Decimal::ZERO) }
}
impl ToDecimal for Decimal {
    fn to_decimal(&self) -> Decimal { *self }
}
impl ToDecimal for Option<Decimal> {
    fn to_decimal(&self) -> Decimal { self.unwrap_or(Decimal::ZERO) }
}

trait ToOptionDecimal {
    fn to_option_decimal(&self) -> Option<Decimal>;
}
impl ToOptionDecimal for String {
    fn to_option_decimal(&self) -> Option<Decimal> { Decimal::from_str(self).ok() }
}
impl ToOptionDecimal for Option<String> {
    fn to_option_decimal(&self) -> Option<Decimal> { self.as_deref().and_then(|s| Decimal::from_str(s).ok()) }
}
impl ToOptionDecimal for Decimal {
    fn to_option_decimal(&self) -> Option<Decimal> { Some(*self) }
}
impl ToOptionDecimal for Option<Decimal> {
    fn to_option_decimal(&self) -> Option<Decimal> { *self }
}

#[derive(Deserialize)]
pub struct VolatilityConfigInput {
    pub mode_name: String,
    pub volatility_type: String,
    pub vol_min: Option<String>,
    pub vol_max: Option<String>,
    pub vol_intervals: Option<i32>,
    pub target_mean: String,
    pub vol_scale: Option<String>,
    pub vol_freedom: Option<String>,
    pub vol_alpha: Option<String>,
    pub vol_beta: Option<String>,
    pub vol_input_mode: String,
    pub vol_fatness_level: Option<String>,
    pub vol_skew_level: Option<String>,
    pub vol_width_level: Option<String>,
}

#[derive(Deserialize)]
pub struct ExpensePhaseInput {
    pub phase_sequence: i32,
    pub trigger_month: i32,
    pub growth_rate_percent: String,
    pub pct_of_revenue: Option<String>,
    pub volatility_configs: Vec<VolatilityConfigInput>,
}

#[derive(Deserialize)]
pub struct CreateExpenseRequest {
    pub plan_id: Uuid,
    pub expense_name: String,
    pub category: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: String,
    pub frequency: String,
    pub phases: Vec<ExpensePhaseInput>,
}

#[derive(Deserialize)]
pub struct UpdateExpenseRequest {
    pub expense_name: String,
    pub category: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: String,
    pub frequency: String,
    pub phases: Vec<ExpensePhaseInput>,
}

#[derive(Serialize)]
pub struct ExpensePolicyResponse {
    pub id: Uuid,
    pub phase_id: Uuid,
    pub mode_name: String,
    pub volatility_type: String,
    pub vol_min: Option<Decimal>,
    pub vol_max: Option<Decimal>,
    pub vol_intervals: Option<i32>,
    pub vol_mean: Option<Decimal>,
    pub vol_scale: Option<Decimal>,
    pub vol_freedom: Option<Decimal>,
    pub vol_alpha: Option<Decimal>,
    pub vol_beta: Option<Decimal>,
    pub target_mean: Decimal,
    pub vol_mu: Decimal,
    pub vol_input_mode: String,
    pub vol_fatness_level: Option<String>,
    pub vol_skew_level: Option<String>,
    pub vol_width_level: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize)]
pub struct ExpensePhaseResponse {
    pub id: Uuid,
    pub expense_item_id: Uuid,
    pub phase_sequence: i32,
    pub trigger_month: i32,
    pub growth_rate_percent: Decimal,
    pub pct_of_revenue: Option<Decimal>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub volatility_configs: Vec<ExpensePolicyResponse>,
}

#[derive(Serialize)]
pub struct ExpenseItemTreeResponse {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub expense_name: String,
    pub category: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: Decimal,
    pub frequency: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub phases: Vec<ExpensePhaseResponse>,
}

// Helper to calculate NRIG parameters
fn calculate_nrig_params(
    mode: &str,
    fatness: Option<&str>,
    skew: Option<&str>,
    width: Option<&str>,
    target_mean: Decimal,
    inp_alpha: Option<Decimal>,
    inp_beta: Option<Decimal>,
    inp_scale: Option<Decimal>,
) -> Result<(Option<Decimal>, Option<Decimal>, Option<Decimal>, Decimal), AppError> {
    let target_mean_f = target_mean.to_f64().unwrap_or(0.0);

    if mode == "simple" {
        // 1. Alpha (Fatness)
        let alpha_f: f64 = match fatness.unwrap_or("heavy") {
            "skinny" => 100.0,
            "normal" => 50.0,
            "moderate" => 2.0,
            "heavy" => 0.5,
            unrecognized => {
                eprintln!("ERROR: Unrecognized fatness option: {}. Defaulting alpha to 50.0 (normal).", unrecognized);
                50.0
            }
        };

        // 2. Beta (Skew)
        let skew_factor: f64 = match skew.unwrap_or("symmetric") {
            "strong_downside" => -0.9,
            "medium_downside" => -0.4,
            "symmetric" => 0.0,
            "medium_upside" => 0.4,
            "strong_upside" => 0.9,
            unrecognized => {
                eprintln!("ERROR: Unrecognized skew option: {}. Defaulting skew to 0.0 (symmetric).", unrecognized);
                0.0
            }
        };
        let beta_f: f64 = alpha_f * skew_factor;

        // 3. Scale/Delta (Width)
        let sigma: f64 = match width.unwrap_or("medium") {
            "very_low" => 1.0,
            "low" => 3.2,
            "medium" => 10.0,
            "high" => 20.0,
            "very_high" => 32.0,
            unrecognized => {
                eprintln!("ERROR: Unrecognized width option: {}. Defaulting width to 10.0 (medium).", unrecognized);
                10.0
            }
        };
        
        // Delta = Sigma^2 * Alpha * (1 - Factor^2)^1.5
        let term = (1.0 - skew_factor.powi(2)).powf(1.5);
        let delta_f = sigma.powi(2) * alpha_f * term;

        // 4. Mu
        // Mu = Target - Delta * (Beta / sqrt(Alpha^2 - Beta^2))
        let denom = (alpha_f.powi(2) - beta_f.powi(2)).sqrt();
        let drift = if denom > 0.0 {
            delta_f * (beta_f / denom)
        } else {
            0.0
        };
        let mu_f = target_mean_f - drift;

        Ok((
            Decimal::from_f64_retain(alpha_f),
            Decimal::from_f64_retain(beta_f),
            Decimal::from_f64_retain(delta_f),
            Decimal::from_f64_retain(mu_f).unwrap_or(target_mean),
        ))
    } else {
        // Advanced Mode
        let alpha = inp_alpha.ok_or_else(|| AppError::ValidationError("Alpha required for advanced NRIG".to_string()))?;
        let beta = inp_beta.ok_or_else(|| AppError::ValidationError("Beta required for advanced NRIG".to_string()))?;
        let scale = inp_scale.ok_or_else(|| AppError::ValidationError("Scale required for advanced NRIG".to_string()))?;

        let alpha_f = alpha.to_f64().unwrap_or(0.0);
        let beta_f = beta.to_f64().unwrap_or(0.0);
        let scale_f = scale.to_f64().unwrap_or(0.0);

        if alpha_f.abs() <= beta_f.abs() {
             return Err(AppError::ValidationError(format!(
                "NRIG Error: Alpha ({}) must be greater than absolute Beta ({})",
                alpha_f, beta_f.abs()
            )));
        }

        let denom = (alpha_f.powi(2) - beta_f.powi(2)).sqrt();
        let drift = if denom > 0.0 {
            scale_f * (beta_f / denom)
        } else {
            0.0
        };
        let mu_f = target_mean_f - drift;

        Ok((Some(alpha), Some(beta), Some(scale), Decimal::from_f64_retain(mu_f).unwrap_or(target_mean)))
    }
}

pub async fn create_expense_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateExpenseRequest>,
) -> Result<Json<ExpenseItemTreeResponse>, AppError> {
    if payload.phases.is_empty() {
        return Err(AppError::ValidationError("At least one phase must be provided.".to_string()));
    }

    // Length Validation
    if payload.expense_name.len() > 255 {
        return Err(AppError::ValidationError("Name exceeds 255 characters".to_string()));
    }
    if payload.category.len() > 255 {
        return Err(AppError::ValidationError("Category exceeds 255 characters".to_string()));
    }

    // Parse Decimals from Strings
    let initial_amount = Decimal::from_str(&payload.initial_amount)
        .map_err(|_| AppError::ValidationError("Invalid format for initial_amount".to_string()))?;
    
    if initial_amount < Decimal::ZERO {
        return Err(AppError::ValidationError("Initial amount must be non-negative".to_string()));
    }

    // Verify plan ownership
    let plan_exists: Option<_> = sqlx::query!(
        "SELECT id FROM financial_plans WHERE id = $1 AND tenant_id = $2",
        payload.plan_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    if plan_exists.is_none() {
        return Err(AppError::NotFound("Financial plan not found or access denied".to_string()));
    }

    let mut tx = pool.begin().await?;

    let item = sqlx::query!(
        r#"
        INSERT INTO expense_items (
            plan_id, expense_name, category, start_month, end_month, initial_amount, frequency
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING 
            id, plan_id, expense_name, category, 
            start_month, end_month, 
            initial_amount, frequency, 
            created_at
        "#,
        payload.plan_id, payload.expense_name, payload.category, payload.start_month, payload.end_month, 
        initial_amount, payload.frequency
    )
    .fetch_one(&mut *tx)
    .await?;

    let mut phases_resp = Vec::new();

    for phase_input in payload.phases {
        let growth_rate_percent = Decimal::from_str(&phase_input.growth_rate_percent)
            .map_err(|_| AppError::ValidationError("Invalid format for growth_rate_percent".to_string()))?;

        let pct_of_revenue = match &phase_input.pct_of_revenue {
            Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for pct_of_revenue".to_string()))?),
            None => None,
        };

        let growth_rate_percent_str = growth_rate_percent.to_string();
        let pct_of_revenue_str = pct_of_revenue.as_ref().map(|v| v.to_string());

        let phase = sqlx::query!(
            r#"
            INSERT INTO expense_item_phases (
                expense_item_id, phase_sequence, trigger_month, growth_rate_percent, pct_of_revenue
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id, expense_item_id, phase_sequence, trigger_month, growth_rate_percent, pct_of_revenue, created_at
            "#,
            item.id, phase_input.phase_sequence, phase_input.trigger_month, growth_rate_percent_str, pct_of_revenue_str
        )
        .fetch_one(&mut *tx)
        .await?;

        let mut policies_resp = Vec::new();

        for config in phase_input.volatility_configs {
            let vol_min = match &config.vol_min {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_min".to_string()))?),
                None => None,
            };

            let vol_max = match &config.vol_max {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_max".to_string()))?),
                None => None,
            };

            let target_mean = Decimal::from_str(&config.target_mean)
                .map_err(|_| AppError::ValidationError("Invalid format for target_mean".to_string()))?;

            let mut vol_scale = match &config.vol_scale {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_scale".to_string()))?),
                None => None,
            };

            let vol_freedom = match &config.vol_freedom {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_freedom".to_string()))?),
                None => None,
            };

            let mut vol_alpha = match &config.vol_alpha {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_alpha".to_string()))?),
                None => None,
            };

            let mut vol_beta = match &config.vol_beta {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_beta".to_string()))?),
                None => None,
            };

            let mut vol_mu = target_mean;

            let valid_vol_types = ["normal", "student_t", "nrig", "flat"];
            if !valid_vol_types.contains(&config.volatility_type.as_str()) {
                return Err(AppError::ValidationError(format!(
                    "Invalid volatility_type: '{}'. Must be one of: {:?}", 
                    config.volatility_type, valid_vol_types
                )));
            }

            if config.volatility_type == "nrig" {
                let (a, b, s, m) = calculate_nrig_params(
                    &config.vol_input_mode,
                    config.vol_fatness_level.as_deref(),
                    config.vol_skew_level.as_deref(),
                    config.vol_width_level.as_deref(),
                    target_mean,
                    vol_alpha,
                    vol_beta,
                    vol_scale
                )?;
                vol_alpha = a;
                vol_beta = b;
                vol_scale = s;
                vol_mu = m;
            }

            let policy = sqlx::query!(
                r#"
                INSERT INTO expense_item_volatility_policies (
                    expense_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                    target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                RETURNING id, expense_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                    target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level, created_at
                "#,
                phase.id, config.mode_name, config.volatility_type, vol_min, vol_max, config.vol_intervals,
                Some(vol_mu), vol_scale, vol_freedom, vol_alpha, vol_beta,
                target_mean, vol_mu, config.vol_input_mode, config.vol_fatness_level, config.vol_skew_level, config.vol_width_level
            )
            .fetch_one(&mut *tx)
            .await?;

            policies_resp.push(ExpensePolicyResponse {
                id: policy.id,
                phase_id: policy.expense_item_phase_id,
                mode_name: policy.mode_name,
                volatility_type: policy.volatility_type,
                vol_min: policy.vol_min.to_option_decimal(),
                vol_max: policy.vol_max.to_option_decimal(),
                vol_intervals: policy.vol_intervals,
                vol_mean: policy.vol_mean.to_option_decimal(),
                vol_scale: policy.vol_scale.to_option_decimal(),
                vol_freedom: policy.vol_freedom.to_option_decimal(),
                vol_alpha: policy.vol_alpha.to_option_decimal(),
                vol_beta: policy.vol_beta.to_option_decimal(),
                target_mean: policy.target_mean.to_decimal(),
                vol_mu: policy.vol_mu.to_decimal(),
                vol_input_mode: policy.vol_input_mode.unwrap_or_default(),
                vol_fatness_level: policy.vol_fatness_level,
                vol_skew_level: policy.vol_skew_level,
                vol_width_level: policy.vol_width_level,
                created_at: policy.created_at,
            });
        }

        phases_resp.push(ExpensePhaseResponse {
            id: phase.id,
            expense_item_id: phase.expense_item_id,
            phase_sequence: phase.phase_sequence.unwrap_or_zero(),
            trigger_month: phase.trigger_month.unwrap_or_zero(),
            growth_rate_percent: phase.growth_rate_percent.to_decimal(),
            pct_of_revenue: phase.pct_of_revenue.to_option_decimal(),
            created_at: phase.created_at,
            volatility_configs: policies_resp,
        });
    }

    tx.commit().await?;

    Ok(Json(ExpenseItemTreeResponse {
        id: item.id,
        plan_id: item.plan_id,
        expense_name: item.expense_name,
        category: item.category,
        start_month: item.start_month.unwrap_or_zero(),
        end_month: item.end_month,
        initial_amount: item.initial_amount.to_decimal(),
        frequency: item.frequency,
        created_at: item.created_at,
        phases: phases_resp,
    }))
}

pub async fn get_expense_items(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<Vec<ExpenseItemTreeResponse>>, AppError> {
    let items = sqlx::query!(
        r#"
        SELECT 
            id, plan_id, expense_name, category, 
            start_month, end_month, 
            initial_amount, frequency, 
            created_at
        FROM expense_items 
        WHERE plan_id = $1 
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        ORDER BY start_month ASC
        "#,
        plan_id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    let mut responses = Vec::new();

    if !items.is_empty() {
        let item_ids: Vec<Uuid> = items.iter().map(|i| i.id).collect();
        
        let phases = sqlx::query!(
            r#"
            SELECT 
                id, expense_item_id, phase_sequence, trigger_month, 
                growth_rate_percent, pct_of_revenue, created_at
            FROM expense_item_phases
            WHERE expense_item_id = ANY($1)
            ORDER BY phase_sequence ASC
            "#,
            &item_ids
        )
        .fetch_all(&pool)
        .await?;

        let phase_ids: Vec<Uuid> = phases.iter().map(|p| p.id).collect();

        let policies = sqlx::query!(
            r#"
            SELECT 
                id, expense_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level,
                created_at
            FROM expense_item_volatility_policies
            WHERE expense_item_phase_id = ANY($1)
            "#,
            &phase_ids
        )
        .fetch_all(&pool)
        .await?;

        for item in items {
            let mut item_phases = Vec::new();
            
            for phase in phases.iter().filter(|p| p.expense_item_id == item.id) {
                let phase_policies = policies.iter().filter(|pol| pol.expense_item_phase_id == phase.id).map(|pol| ExpensePolicyResponse {
                    id: pol.id,
                    phase_id: pol.expense_item_phase_id,
                    mode_name: pol.mode_name.clone(),
                    volatility_type: pol.volatility_type.clone(),
                    vol_min: pol.vol_min.to_option_decimal(),
                    vol_max: pol.vol_max.to_option_decimal(),
                    vol_intervals: pol.vol_intervals,
                    vol_mean: pol.vol_mean.to_option_decimal(),
                    vol_scale: pol.vol_scale.to_option_decimal(),
                    vol_freedom: pol.vol_freedom.to_option_decimal(),
                    vol_alpha: pol.vol_alpha.to_option_decimal(),
                    vol_beta: pol.vol_beta.to_option_decimal(),
                    target_mean: pol.target_mean.to_decimal(),
                    vol_mu: pol.vol_mu.to_decimal(),
                    vol_input_mode: pol.vol_input_mode.clone().unwrap_or_default(),
                    vol_fatness_level: pol.vol_fatness_level.clone(),
                    vol_skew_level: pol.vol_skew_level.clone(),
                    vol_width_level: pol.vol_width_level.clone(),
                    created_at: pol.created_at,
                }).collect();

                item_phases.push(ExpensePhaseResponse {
                    id: phase.id,
                    expense_item_id: phase.expense_item_id,
                    phase_sequence: phase.phase_sequence.unwrap_or_zero(),
                    trigger_month: phase.trigger_month.unwrap_or_zero(),
                    growth_rate_percent: phase.growth_rate_percent.to_decimal(),
                    pct_of_revenue: phase.pct_of_revenue.to_option_decimal(),
                    created_at: phase.created_at,
                    volatility_configs: phase_policies,
                });
            }

            responses.push(ExpenseItemTreeResponse {
                id: item.id,
                plan_id: item.plan_id,
                expense_name: item.expense_name.clone(),
                category: item.category.clone(),
                start_month: item.start_month.unwrap_or_zero(),
                end_month: item.end_month,
                initial_amount: item.initial_amount.to_decimal(),
                frequency: item.frequency.clone(),
                created_at: item.created_at,
                phases: item_phases,
            });
        }
    }

    Ok(Json(responses))
}

pub async fn update_expense_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateExpenseRequest>,
) -> Result<Json<ExpenseItemTreeResponse>, AppError> {
    if payload.phases.is_empty() {
        return Err(AppError::ValidationError("At least one phase must be provided.".to_string()));
    }

    // Length Validation
    if payload.expense_name.len() > 255 {
        return Err(AppError::ValidationError("Name exceeds 255 characters".to_string()));
    }
    if payload.category.len() > 255 {
        return Err(AppError::ValidationError("Category exceeds 255 characters".to_string()));
    }

    // Parse Decimals from Strings
    let initial_amount = Decimal::from_str(&payload.initial_amount)
        .map_err(|_| AppError::ValidationError("Invalid format for initial_amount".to_string()))?;
    
    if initial_amount < Decimal::ZERO {
        return Err(AppError::ValidationError("Initial amount must be non-negative".to_string()));
    }

    let mut tx = pool.begin().await?;

    let item = sqlx::query!(
        r#"
        UPDATE expense_items SET
            expense_name = $1, category = $2, start_month = $3, end_month = $4,
            initial_amount = $5, frequency = $6
        WHERE id = $7
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $8)
        RETURNING 
            id, plan_id, expense_name, category, 
            start_month, end_month, 
            initial_amount, frequency, 
            created_at
        "#,
        payload.expense_name, payload.category, payload.start_month, payload.end_month, 
        initial_amount, payload.frequency,
        id,
        claims.tenant_id
    )
    .fetch_one(&mut *tx)
    .await?;

    // Delete existing policies and phases
    sqlx::query!("DELETE FROM expense_item_volatility_policies WHERE expense_item_phase_id IN (SELECT id FROM expense_item_phases WHERE expense_item_id = $1)", id)
        .execute(&mut *tx).await?;
    sqlx::query!("DELETE FROM expense_item_phases WHERE expense_item_id = $1", id)
        .execute(&mut *tx).await?;

    let mut phases_resp = Vec::new();

    for phase_input in payload.phases {
        let growth_rate_percent = Decimal::from_str(&phase_input.growth_rate_percent)
            .map_err(|_| AppError::ValidationError("Invalid format for growth_rate_percent".to_string()))?;

        let pct_of_revenue = match &phase_input.pct_of_revenue {
            Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for pct_of_revenue".to_string()))?),
            None => None,
        };

        let growth_rate_percent_str = growth_rate_percent.to_string();
        let pct_of_revenue_str = pct_of_revenue.as_ref().map(|v| v.to_string());

        let phase = sqlx::query!(
            r#"
            INSERT INTO expense_item_phases (
                expense_item_id, phase_sequence, trigger_month, growth_rate_percent, pct_of_revenue
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id, expense_item_id, phase_sequence, trigger_month, growth_rate_percent, pct_of_revenue, created_at
            "#,
            item.id, phase_input.phase_sequence, phase_input.trigger_month, growth_rate_percent_str, pct_of_revenue_str
        )
        .fetch_one(&mut *tx)
        .await?;

        let mut policies_resp = Vec::new();

        for config in phase_input.volatility_configs {
            let vol_min = match &config.vol_min {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_min".to_string()))?),
                None => None,
            };

            let vol_max = match &config.vol_max {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_max".to_string()))?),
                None => None,
            };

            let target_mean = Decimal::from_str(&config.target_mean)
                .map_err(|_| AppError::ValidationError("Invalid format for target_mean".to_string()))?;

            let mut vol_scale = match &config.vol_scale {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_scale".to_string()))?),
                None => None,
            };

            let vol_freedom = match &config.vol_freedom {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_freedom".to_string()))?),
                None => None,
            };

            let mut vol_alpha = match &config.vol_alpha {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_alpha".to_string()))?),
                None => None,
            };

            let mut vol_beta = match &config.vol_beta {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_beta".to_string()))?),
                None => None,
            };

            let mut vol_mu = target_mean;

            let valid_vol_types = ["normal", "student_t", "nrig", "flat"];
            if !valid_vol_types.contains(&config.volatility_type.as_str()) {
                return Err(AppError::ValidationError(format!(
                    "Invalid volatility_type: '{}'. Must be one of: {:?}", 
                    config.volatility_type, valid_vol_types
                )));
            }

            if config.volatility_type == "nrig" {
                let (a, b, s, m) = calculate_nrig_params(
                    &config.vol_input_mode,
                    config.vol_fatness_level.as_deref(),
                    config.vol_skew_level.as_deref(),
                    config.vol_width_level.as_deref(),
                    target_mean,
                    vol_alpha,
                    vol_beta,
                    vol_scale
                )?;
                vol_alpha = a;
                vol_beta = b;
                vol_scale = s;
                vol_mu = m;
            }

            let policy = sqlx::query!(
                r#"
                INSERT INTO expense_item_volatility_policies (
                    expense_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                    target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                RETURNING id, expense_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                    target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level, created_at
                "#,
                phase.id, config.mode_name, config.volatility_type, vol_min, vol_max, config.vol_intervals,
                Some(vol_mu), vol_scale, vol_freedom, vol_alpha, vol_beta,
                target_mean, vol_mu, config.vol_input_mode, config.vol_fatness_level, config.vol_skew_level, config.vol_width_level
            )
            .fetch_one(&mut *tx)
            .await?;

            policies_resp.push(ExpensePolicyResponse {
                id: policy.id,
                phase_id: policy.expense_item_phase_id,
                mode_name: policy.mode_name,
                volatility_type: policy.volatility_type,
                vol_min: policy.vol_min.to_option_decimal(),
                vol_max: policy.vol_max.to_option_decimal(),
                vol_intervals: policy.vol_intervals,
                vol_mean: policy.vol_mean.to_option_decimal(),
                vol_scale: policy.vol_scale.to_option_decimal(),
                vol_freedom: policy.vol_freedom.to_option_decimal(),
                vol_alpha: policy.vol_alpha.to_option_decimal(),
                vol_beta: policy.vol_beta.to_option_decimal(),
                target_mean: policy.target_mean.to_decimal(),
                vol_mu: policy.vol_mu.to_decimal(),
                vol_input_mode: policy.vol_input_mode.unwrap_or_default(),
                vol_fatness_level: policy.vol_fatness_level,
                vol_skew_level: policy.vol_skew_level,
                vol_width_level: policy.vol_width_level,
                created_at: policy.created_at,
            });
        }

        phases_resp.push(ExpensePhaseResponse {
            id: phase.id,
            expense_item_id: phase.expense_item_id,
            phase_sequence: phase.phase_sequence.unwrap_or_zero(),
            trigger_month: phase.trigger_month.unwrap_or_zero(),
            growth_rate_percent: phase.growth_rate_percent.to_decimal(),
            pct_of_revenue: phase.pct_of_revenue.to_option_decimal(),
            created_at: phase.created_at,
            volatility_configs: policies_resp,
        });
    }

    tx.commit().await?;

    Ok(Json(ExpenseItemTreeResponse {
        id: item.id,
        plan_id: item.plan_id,
        expense_name: item.expense_name,
        category: item.category,
        start_month: item.start_month.unwrap_or_zero(),
        end_month: item.end_month,
        initial_amount: item.initial_amount.to_decimal(),
        frequency: item.frequency,
        created_at: item.created_at,
        phases: phases_resp,
    }))
}

pub async fn delete_expense_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result: sqlx::postgres::PgQueryResult = sqlx::query!(
        "DELETE FROM expense_items WHERE id = $1 AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)",
        id,
        claims.tenant_id
    )
    .execute(&pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Item not found or access denied".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
