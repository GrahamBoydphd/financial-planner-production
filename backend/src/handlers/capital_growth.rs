use axum::{
    extract::{Path, State},
    Extension,
    Json,
};
use serde::Deserialize;
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use rust_decimal::Decimal;
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
    pub vol_mean: Option<String>,
    pub vol_scale: Option<String>,
    pub vol_freedom: Option<String>,
    pub vol_alpha: Option<String>,
    pub vol_beta: Option<String>,
}

fn parse_decimal(opt: Option<String>) -> Result<Option<Decimal>, AppError> {
    match opt {
        Some(s) if !s.trim().is_empty() => {
            Decimal::from_str(&s).map(Some).map_err(|_| AppError::ValidationError("Invalid decimal format".to_string()))
        }
        _ => Ok(None),
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
    // growth_rate_percent is NOT NULL in DB, so default to 0 if missing
    let growth_rate = parse_decimal(payload.growth_rate_percent.clone())?.unwrap_or(Decimal::from(0));
    
    let vol_min = parse_decimal(payload.vol_min.clone())?;
    let vol_max = parse_decimal(payload.vol_max.clone())?;
    let vol_mean = parse_decimal(payload.vol_mean.clone())?;
    let vol_scale = parse_decimal(payload.vol_scale.clone())?;
    let vol_freedom = parse_decimal(payload.vol_freedom.clone())?;
    let vol_alpha = parse_decimal(payload.vol_alpha.clone())?;
    let vol_beta = parse_decimal(payload.vol_beta.clone())?;

    // NRIG Validation
    if payload.volatility_type == "nrig" {
        match (vol_alpha, vol_beta) {
            (Some(alpha), Some(beta)) => {
                if (alpha * alpha) <= (beta * beta) {
                    return Err(AppError::ValidationError(format!(
                        "NRIG Error: Alpha ({}) must be greater than absolute Beta ({})",
                        alpha, beta.abs()
                    )));
                }
            }
            _ => {
                return Err(AppError::ValidationError(
                    "NRIG volatility requires both Alpha and Beta parameters".to_string()
                ));
            }
        }
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
            vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING 
            id, plan_id, volatility_type, 
            growth_rate_percent as "growth_rate_percent!", 
            vol_min, vol_max, vol_intervals, 
            vol_mean, vol_scale, vol_freedom, 
            vol_alpha, vol_beta, 
            created_at as "created_at!"
        "#,
        payload.plan_id,
        payload.volatility_type,
        growth_rate,
        vol_min,
        vol_max,
        payload.vol_intervals,
        vol_mean,
        vol_scale,
        vol_freedom,
        vol_alpha,
        vol_beta
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
