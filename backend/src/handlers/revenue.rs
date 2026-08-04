use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
    Extension,
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

trait UnwrapOrTimeBased {
    fn unwrap_or_time_based(self) -> String;
}
impl UnwrapOrTimeBased for String {
    fn unwrap_or_time_based(self) -> String { self }
}
impl UnwrapOrTimeBased for Option<String> {
    fn unwrap_or_time_based(self) -> String { self.unwrap_or_else(|| "time_based".to_string()) }
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
pub struct RevenuePhaseInput {
    pub phase_sequence: i32,
    pub trigger_month: Option<i32>,
    pub trigger_threshold: Option<String>,
    pub trigger_operator: Option<String>,
    pub growth_rate_percent: String,
    pub cost_of_revenue_percent: Option<String>,
    pub baseline_increment: Option<String>,
    pub volatility_configs: Vec<VolatilityConfigInput>,
}

#[derive(Deserialize)]
pub struct CreateRevenueRequest {
    pub plan_id: Uuid,
    pub revenue_name: String,
    pub source: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: String,
    pub frequency: String,
    pub trigger_strategy: Option<String>,
    pub trigger_threshold: Option<String>,
    pub trigger_operator: Option<String>,
    pub phases: Vec<RevenuePhaseInput>,
}

#[derive(Deserialize)]
pub struct UpdateRevenueRequest {
    pub revenue_name: String,
    pub source: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: String,
    pub frequency: String,
    pub trigger_strategy: Option<String>,
    pub trigger_threshold: Option<String>,
    pub trigger_operator: Option<String>,
    pub phases: Vec<RevenuePhaseInput>,
}

#[derive(Serialize)]
pub struct RevenuePolicyResponse {
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
pub struct RevenuePhaseResponse {
    pub id: Uuid,
    pub revenue_item_id: Uuid,
    pub phase_sequence: i32,
    pub trigger_month: Option<i32>,
    pub trigger_threshold: Option<String>,
    pub trigger_operator: Option<String>,
    pub growth_rate_percent: Decimal,
    pub cost_of_revenue_percent: Option<Decimal>,
    pub baseline_increment: Option<Decimal>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub volatility_configs: Vec<RevenuePolicyResponse>,
}

#[derive(Serialize)]
pub struct RevenueItemTreeResponse {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub revenue_name: String,
    pub source: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: Decimal,
    pub frequency: String,
    pub trigger_strategy: String,
    pub trigger_threshold: Option<String>,
    pub trigger_operator: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub phases: Vec<RevenuePhaseResponse>,
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

pub async fn create_revenue_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateRevenueRequest>,
) -> Result<Json<RevenueItemTreeResponse>, AppError> {
    if payload.phases.is_empty() {
        return Err(AppError::ValidationError("At least one phase must be provided.".to_string()));
    }

    // Length Validation
    if payload.revenue_name.len() > 255 {
        return Err(AppError::ValidationError("Name exceeds 255 characters".to_string()));
    }
    if payload.source.len() > 255 {
        return Err(AppError::ValidationError("Source exceeds 255 characters".to_string()));
    }

    // Parse Decimals from Strings
    let initial_amount = Decimal::from_str(&payload.initial_amount)
        .map_err(|_| AppError::ValidationError("Invalid format for initial_amount".to_string()))?;
    
    if initial_amount < Decimal::ZERO {
        return Err(AppError::ValidationError("Initial amount must be non-negative".to_string()));
    }

    let valid_frequencies = ["monthly", "quarterly", "annually", "one_time"];
    if !valid_frequencies.contains(&payload.frequency.as_str()) {
        return Err(AppError::ValidationError(format!(
            "Invalid frequency: '{}'. Must be one of: {:?}", 
            payload.frequency, valid_frequencies
        )));
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
        return Err(AppError::NotFound("Financial plan not found".to_string()));
    }

    let mut tx = pool.begin().await.map_err(|e| AppError::ValidationError(format!("Failed to start transaction: {}", e)))?;

    let trigger_strategy = payload.trigger_strategy.as_deref().unwrap_or("time_based");

    let item = sqlx::query!(
        r#"
        INSERT INTO revenue_items (
            plan_id, revenue_name, source, start_month, end_month, initial_amount, frequency, trigger_strategy, trigger_threshold, trigger_operator
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING 
            id, plan_id, revenue_name, source, 
            start_month, end_month, 
            initial_amount, frequency, trigger_strategy,
            trigger_threshold, trigger_operator,
            created_at
        "#,
        payload.plan_id, payload.revenue_name, payload.source, payload.start_month, payload.end_month, 
        initial_amount, payload.frequency, trigger_strategy, payload.trigger_threshold, payload.trigger_operator
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::ValidationError(format!("Database insert failed: {}", e)))?;

    let mut phases_resp = Vec::new();

    for phase_input in payload.phases {
        let growth_rate_percent = Decimal::from_str(&phase_input.growth_rate_percent)
            .map_err(|_| AppError::ValidationError("Invalid format for growth_rate_percent".to_string()))?;

        let cost_of_revenue_percent = match &phase_input.cost_of_revenue_percent {
            Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for cost_of_revenue_percent".to_string()))?),
            None => None,
        };

        let growth_rate_percent_str = growth_rate_percent.to_string();
        let cost_of_revenue_percent_str = cost_of_revenue_percent.as_ref().map(|v| v.to_string());
        let baseline_increment_dec = phase_input.baseline_increment.to_option_decimal();

        let phase = sqlx::query!(
            r#"
            INSERT INTO revenue_item_phases (
                revenue_item_id, phase_sequence, trigger_month, trigger_threshold, trigger_operator, growth_rate_percent, cost_of_revenue_percent, baseline_increment
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, revenue_item_id, phase_sequence, trigger_month, trigger_threshold, trigger_operator, growth_rate_percent, cost_of_revenue_percent, baseline_increment, created_at
            "#,
            item.id, phase_input.phase_sequence, phase_input.trigger_month, phase_input.trigger_threshold, phase_input.trigger_operator, growth_rate_percent_str, cost_of_revenue_percent_str, baseline_increment_dec
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::ValidationError(format!("Failed to insert phase: {}", e)))?;

        let mut policies_resp = Vec::new();

        for config in phase_input.volatility_configs {
            let target_mean = Decimal::from_str(&config.target_mean)
                .map_err(|_| AppError::ValidationError("Invalid format for target_mean".to_string()))?;

            let vol_min = match &config.vol_min {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_min".to_string()))?),
                None => None,
            };

            let vol_max = match &config.vol_max {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_max".to_string()))?),
                None => None,
            };

            let vol_scale = match &config.vol_scale {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_scale".to_string()))?),
                None => None,
            };

            let vol_freedom = match &config.vol_freedom {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_freedom".to_string()))?),
                None => None,
            };

            let vol_alpha = match &config.vol_alpha {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_alpha".to_string()))?),
                None => None,
            };

            let vol_beta = match &config.vol_beta {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_beta".to_string()))?),
                None => None,
            };

            let mut vol_mu = target_mean;
            let mut final_alpha = vol_alpha;
            let mut final_beta = vol_beta;
            let mut final_scale = vol_scale;

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
                final_alpha = a;
                final_beta = b;
                final_scale = s;
                vol_mu = m;
            }

            let policy = sqlx::query!(
                r#"
                INSERT INTO revenue_item_volatility_policies (
                    revenue_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                    target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
                )
                RETURNING id, revenue_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                    target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level, created_at
                "#,
                phase.id, config.mode_name, config.volatility_type, vol_min, vol_max, config.vol_intervals,
                Some(vol_mu), final_scale, vol_freedom, final_alpha, final_beta,
                target_mean, vol_mu, config.vol_input_mode, config.vol_fatness_level, config.vol_skew_level, config.vol_width_level
            )
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| AppError::ValidationError(format!("Failed to insert volatility policy: {}", e)))?;

            policies_resp.push(RevenuePolicyResponse {
                id: policy.id,
                phase_id: policy.revenue_item_phase_id,
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

        phases_resp.push(RevenuePhaseResponse {
            id: phase.id,
            revenue_item_id: phase.revenue_item_id,
            phase_sequence: phase.phase_sequence.unwrap_or_zero(),
            trigger_month: phase.trigger_month,
            trigger_threshold: phase.trigger_threshold,
            trigger_operator: phase.trigger_operator,
            growth_rate_percent: phase.growth_rate_percent.to_decimal(),
            cost_of_revenue_percent: phase.cost_of_revenue_percent.to_option_decimal(),
            baseline_increment: phase.baseline_increment.to_option_decimal(),
            created_at: phase.created_at,
            volatility_configs: policies_resp,
        });
    }

    tx.commit().await.map_err(|e| AppError::ValidationError(format!("Failed to commit transaction: {}", e)))?;

    Ok(Json(RevenueItemTreeResponse {
        id: item.id,
        plan_id: item.plan_id,
        revenue_name: item.revenue_name,
        source: item.source,
        start_month: item.start_month.unwrap_or_zero(),
        end_month: item.end_month,
        initial_amount: item.initial_amount.to_decimal(),
        frequency: item.frequency,
        trigger_strategy: item.trigger_strategy.unwrap_or_time_based(),
        trigger_threshold: item.trigger_threshold,
        trigger_operator: item.trigger_operator,
        created_at: item.created_at,
        phases: phases_resp,
    }))
}

pub async fn get_revenue_items(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<Vec<RevenueItemTreeResponse>>, AppError> {
    let items = sqlx::query!(
        r#"
        SELECT 
            id, plan_id, revenue_name, source, 
            start_month, end_month, 
            initial_amount, frequency, trigger_strategy,
            trigger_threshold, trigger_operator,
            created_at
        FROM revenue_items 
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
                id, revenue_item_id, phase_sequence, trigger_month, trigger_threshold, trigger_operator,
                growth_rate_percent, cost_of_revenue_percent, baseline_increment, created_at
            FROM revenue_item_phases
            WHERE revenue_item_id = ANY($1)
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
                id, revenue_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level,
                created_at
            FROM revenue_item_volatility_policies
            WHERE revenue_item_phase_id = ANY($1)
            "#,
            &phase_ids
        )
        .fetch_all(&pool)
        .await?;

        for item in items {
            let mut item_phases = Vec::new();
            
            for phase in phases.iter().filter(|p| p.revenue_item_id == item.id) {
                let phase_policies = policies.iter().filter(|pol| pol.revenue_item_phase_id == phase.id).map(|pol| RevenuePolicyResponse {
                    id: pol.id,
                    phase_id: pol.revenue_item_phase_id,
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

                item_phases.push(RevenuePhaseResponse {
                    id: phase.id,
                    revenue_item_id: phase.revenue_item_id,
                    phase_sequence: phase.phase_sequence.unwrap_or_zero(),
                    trigger_month: phase.trigger_month,
                    trigger_threshold: phase.trigger_threshold.clone(),
                    trigger_operator: phase.trigger_operator.clone(),
                    growth_rate_percent: phase.growth_rate_percent.to_decimal(),
                    cost_of_revenue_percent: phase.cost_of_revenue_percent.to_option_decimal(),
                    baseline_increment: phase.baseline_increment.to_option_decimal(),
                    created_at: phase.created_at,
                    volatility_configs: phase_policies,
                });
            }

            responses.push(RevenueItemTreeResponse {
                id: item.id,
                plan_id: item.plan_id,
                revenue_name: item.revenue_name.clone(),
                source: item.source.clone(),
                start_month: item.start_month.unwrap_or_zero(),
                end_month: item.end_month,
                initial_amount: item.initial_amount.to_decimal(),
                frequency: item.frequency.clone(),
                trigger_strategy: item.trigger_strategy.clone().unwrap_or_time_based(),
                trigger_threshold: item.trigger_threshold.clone(),
                trigger_operator: item.trigger_operator.clone(),
                created_at: item.created_at,
                phases: item_phases,
            });
        }
    }

    Ok(Json(responses))
}

pub async fn update_revenue_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateRevenueRequest>,
) -> Result<Json<RevenueItemTreeResponse>, AppError> {
    if payload.phases.is_empty() {
        return Err(AppError::ValidationError("At least one phase must be provided.".to_string()));
    }

    // Length Validation
    if payload.revenue_name.len() > 255 {
        return Err(AppError::ValidationError("Name exceeds 255 characters".to_string()));
    }
    if payload.source.len() > 255 {
        return Err(AppError::ValidationError("Source exceeds 255 characters".to_string()));
    }

    // Parse Decimals from Strings
    let initial_amount = Decimal::from_str(&payload.initial_amount)
        .map_err(|_| AppError::ValidationError("Invalid format for initial_amount".to_string()))?;
    
    if initial_amount < Decimal::ZERO {
        return Err(AppError::ValidationError("Initial amount must be non-negative".to_string()));
    }

    let valid_frequencies = ["monthly", "quarterly", "annually", "one_time"];
    if !valid_frequencies.contains(&payload.frequency.as_str()) {
        return Err(AppError::ValidationError(format!(
            "Invalid frequency: '{}'. Must be one of: {:?}", 
            payload.frequency, valid_frequencies
        )));
    }

    let mut tx = pool.begin().await.map_err(|e| AppError::ValidationError(format!("Failed to start transaction: {}", e)))?;

    let trigger_strategy = payload.trigger_strategy.as_deref().unwrap_or("time_based");

    let item = sqlx::query!(
        r#"
        UPDATE revenue_items SET
            revenue_name = $1, source = $2, start_month = $3, end_month = $4,
            initial_amount = $5, frequency = $6, trigger_strategy = $7,
            trigger_threshold = $8, trigger_operator = $9
        WHERE id = $10
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $11)
        RETURNING 
            id, plan_id, revenue_name, source, 
            start_month, end_month, 
            initial_amount, frequency, trigger_strategy,
            trigger_threshold, trigger_operator,
            created_at
        "#,
        payload.revenue_name, payload.source, payload.start_month, payload.end_month, 
        initial_amount, payload.frequency, trigger_strategy,
        payload.trigger_threshold, payload.trigger_operator,
        id,
        claims.tenant_id
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| AppError::ValidationError(format!("Database update failed: {}", e)))?;

    // Delete existing policies and phases
    sqlx::query!("DELETE FROM revenue_item_volatility_policies WHERE revenue_item_phase_id IN (SELECT id FROM revenue_item_phases WHERE revenue_item_id = $1)", id)
        .execute(&mut *tx).await?;
    sqlx::query!("DELETE FROM revenue_item_phases WHERE revenue_item_id = $1", id)
        .execute(&mut *tx).await?;

    let mut phases_resp = Vec::new();

    for phase_input in payload.phases {
        let growth_rate_percent = Decimal::from_str(&phase_input.growth_rate_percent)
            .map_err(|_| AppError::ValidationError("Invalid format for growth_rate_percent".to_string()))?;

        let cost_of_revenue_percent = match &phase_input.cost_of_revenue_percent {
            Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for cost_of_revenue_percent".to_string()))?),
            None => None,
        };

        let growth_rate_percent_str = growth_rate_percent.to_string();
        let cost_of_revenue_percent_str = cost_of_revenue_percent.as_ref().map(|v| v.to_string());
        let baseline_increment_dec = phase_input.baseline_increment.to_option_decimal();

        let phase = sqlx::query!(
            r#"
            INSERT INTO revenue_item_phases (
                revenue_item_id, phase_sequence, trigger_month, trigger_threshold, trigger_operator, growth_rate_percent, cost_of_revenue_percent, baseline_increment
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, revenue_item_id, phase_sequence, trigger_month, trigger_threshold, trigger_operator, growth_rate_percent, cost_of_revenue_percent, baseline_increment, created_at
            "#,
            item.id, phase_input.phase_sequence, phase_input.trigger_month, phase_input.trigger_threshold, phase_input.trigger_operator, growth_rate_percent_str, cost_of_revenue_percent_str, baseline_increment_dec
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AppError::ValidationError(format!("Failed to insert phase: {}", e)))?;

        let mut policies_resp = Vec::new();

        for config in phase_input.volatility_configs {
            let target_mean = Decimal::from_str(&config.target_mean)
                .map_err(|_| AppError::ValidationError("Invalid format for target_mean".to_string()))?;

            let vol_min = match &config.vol_min {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_min".to_string()))?),
                None => None,
            };

            let vol_max = match &config.vol_max {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_max".to_string()))?),
                None => None,
            };

            let vol_scale = match &config.vol_scale {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_scale".to_string()))?),
                None => None,
            };

            let vol_freedom = match &config.vol_freedom {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_freedom".to_string()))?),
                None => None,
            };

            let vol_alpha = match &config.vol_alpha {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_alpha".to_string()))?),
                None => None,
            };

            let vol_beta = match &config.vol_beta {
                Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_beta".to_string()))?),
                None => None,
            };

            let mut vol_mu = target_mean;
            let mut final_alpha = vol_alpha;
            let mut final_beta = vol_beta;
            let mut final_scale = vol_scale;

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
                final_alpha = a;
                final_beta = b;
                final_scale = s;
                vol_mu = m;
            }

            let policy = sqlx::query!(
                r#"
                INSERT INTO revenue_item_volatility_policies (
                    revenue_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                    target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
                )
                RETURNING id, revenue_item_phase_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
                    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
                    target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level, created_at
                "#,
                phase.id, config.mode_name, config.volatility_type, vol_min, vol_max, config.vol_intervals,
                Some(vol_mu), final_scale, vol_freedom, final_alpha, final_beta,
                target_mean, vol_mu, config.vol_input_mode, config.vol_fatness_level, config.vol_skew_level, config.vol_width_level
            )
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| AppError::ValidationError(format!("Failed to insert volatility policy: {}", e)))?;

            policies_resp.push(RevenuePolicyResponse {
                id: policy.id,
                phase_id: policy.revenue_item_phase_id,
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

        phases_resp.push(RevenuePhaseResponse {
            id: phase.id,
            revenue_item_id: phase.revenue_item_id,
            phase_sequence: phase.phase_sequence.unwrap_or_zero(),
            trigger_month: phase.trigger_month,
            trigger_threshold: phase.trigger_threshold,
            trigger_operator: phase.trigger_operator,
            growth_rate_percent: phase.growth_rate_percent.to_decimal(),
            cost_of_revenue_percent: phase.cost_of_revenue_percent.to_option_decimal(),
            baseline_increment: phase.baseline_increment.to_option_decimal(),
            created_at: phase.created_at,
            volatility_configs: policies_resp,
        });
    }

    tx.commit().await.map_err(|e| AppError::ValidationError(format!("Failed to commit transaction: {}", e)))?;

    Ok(Json(RevenueItemTreeResponse {
        id: item.id,
        plan_id: item.plan_id,
        revenue_name: item.revenue_name,
        source: item.source,
        start_month: item.start_month.unwrap_or_zero(),
        end_month: item.end_month,
        initial_amount: item.initial_amount.to_decimal(),
        frequency: item.frequency,
        trigger_strategy: item.trigger_strategy.unwrap_or_time_based(),
        trigger_threshold: item.trigger_threshold,
        trigger_operator: item.trigger_operator,
        created_at: item.created_at,
        phases: phases_resp,
    }))
}

pub async fn delete_revenue_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result: sqlx::postgres::PgQueryResult = sqlx::query!(
        "DELETE FROM revenue_items WHERE id = $1 AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)", 
        id,
        claims.tenant_id
    )
        .execute(&pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Item not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
