use axum::{
    extract::{Path, State},
    Extension,
    Json,
};
use serde::Deserialize;
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use std::str::FromStr;
use crate::models::{CapitalGrowthPolicy, Claims};
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct UpsertGrowthRequest {
    pub plan_id: Uuid,
    pub volatility_type: String,
    pub growth_rate_percent: Option<String>,
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

fn parse_decimal(opt: Option<String>) -> Result<Option<Decimal>, AppError> {
    match opt {
        Some(s) if !s.trim().is_empty() => {
            Decimal::from_str(&s).map(Some).map_err(|_| AppError::ValidationError("Invalid decimal format".to_string()))
        }
        _ => Ok(None),
    }
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
            "heavy" | _ => 0.5,
        };

        // 2. Beta (Skew)
        let skew_factor: f64 = match skew.unwrap_or("symmetric") {
            "strong_downside" => -0.9,
            "medium_downside" => -0.4,
            "symmetric" => 0.0,
            "medium_upside" => 0.4,
            "strong_upside" => 0.9,
            _ => 0.0,
        };
        let beta_f: f64 = alpha_f * skew_factor;

        // 3. Scale/Delta (Width)
        let sigma: f64 = match width.unwrap_or("medium") {
            "very_low" => 1.0,
            "low" => 3.2,
            "medium" => 10.0,
            "high" => 32.0,
            _ => 10.0,
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

pub async fn upsert_capital_growth(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpsertGrowthRequest>,
) -> Result<Json<CapitalGrowthPolicy>, AppError> {
    // Verify plan ownership first
    let _plan = sqlx::query!(
        "SELECT id FROM financial_plans WHERE id = $1 AND tenant_id = $2",
        payload.plan_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Financial plan not found".to_string()))?;

    // Parse decimals manually
    let growth_rate = parse_decimal(payload.growth_rate_percent.clone())?.unwrap_or(Decimal::from(0));
    
    let vol_min = parse_decimal(payload.vol_min.clone())?;
    let vol_max = parse_decimal(payload.vol_max.clone())?;
    let target_mean = Decimal::from_str(&payload.target_mean)
        .map_err(|_| AppError::ValidationError("Invalid format for target_mean".to_string()))?;
    
    let mut vol_scale = parse_decimal(payload.vol_scale.clone())?;
    let vol_freedom = parse_decimal(payload.vol_freedom.clone())?;
    let mut vol_alpha = parse_decimal(payload.vol_alpha.clone())?;
    let mut vol_beta = parse_decimal(payload.vol_beta.clone())?;

    let mut vol_mu = target_mean;

    if payload.volatility_type == "nrig" {
        let (a, b, s, m) = calculate_nrig_params(
            &payload.vol_input_mode,
            payload.vol_fatness_level.as_deref(),
            payload.vol_skew_level.as_deref(),
            payload.vol_width_level.as_deref(),
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

    let mut tx = pool.begin().await?;

    // Delete existing
    sqlx::query!("DELETE FROM capital_growth_policies WHERE plan_id = $1", payload.plan_id)
        .execute(&mut *tx)
        .await?;

    // Insert new
    let policy = sqlx::query_as!(
        CapitalGrowthPolicy,
        r#"
        INSERT INTO capital_growth_policies (
            plan_id, volatility_type, growth_rate_percent, vol_min, vol_max, vol_intervals, 
            vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
            target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING 
            id, plan_id, volatility_type, 
            growth_rate_percent as "growth_rate_percent!", 
            vol_min, vol_max, vol_intervals, 
            vol_mean, vol_scale, vol_freedom, 
            vol_alpha, vol_beta, 
            target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level,
            created_at as "created_at!"
        "#,
        payload.plan_id,
        payload.volatility_type,
        growth_rate,
        vol_min,
        vol_max,
        payload.vol_intervals,
        vol_mu, // Legacy vol_mean gets the calculated mu
        vol_scale,
        vol_freedom,
        vol_alpha,
        vol_beta,
        target_mean,
        vol_mu,
        payload.vol_input_mode,
        payload.vol_fatness_level,
        payload.vol_skew_level,
        payload.vol_width_level
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(policy))
}

pub async fn get_capital_growth(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<CapitalGrowthPolicy>, AppError> {
    let policy = sqlx::query_as!(
        CapitalGrowthPolicy,
        r#"
        SELECT 
            id, plan_id, volatility_type, 
            growth_rate_percent as "growth_rate_percent!", 
            vol_min, vol_max, vol_intervals, 
            vol_mean, vol_scale, vol_freedom, 
            vol_alpha, vol_beta, 
            target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level,
            created_at as "created_at!"
        FROM capital_growth_policies

        WHERE plan_id = $1 
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        "#,
        plan_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or(AppError::NotFound("Policy not found".to_string()))?;

    Ok(Json(policy))
}
