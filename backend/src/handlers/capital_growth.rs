use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use rust_decimal::Decimal;
use crate::models::CapitalGrowthPolicy;
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct UpsertGrowthRequest {
    pub plan_id: Uuid,
    pub volatility_type: String,
    pub vol_min: Option<Decimal>,
    pub vol_max: Option<Decimal>,
    pub vol_intervals: Option<i32>,
    pub vol_mean: Option<Decimal>,
    pub vol_scale: Option<Decimal>,
    pub vol_freedom: Option<Decimal>,
    pub vol_alpha: Option<Decimal>,
    pub vol_beta: Option<Decimal>,
}

pub async fn upsert_capital_growth(
    State(pool): State<Pool<Postgres>>,
    Json(payload): Json<UpsertGrowthRequest>,
) -> Result<Json<CapitalGrowthPolicy>, AppError> {
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
            plan_id, volatility_type, vol_min, vol_max, vol_intervals, 
            vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        "#,
        payload.plan_id,
        payload.volatility_type,
        payload.vol_min,
        payload.vol_max,
        payload.vol_intervals,
        payload.vol_mean,
        payload.vol_scale,
        payload.vol_freedom,
        payload.vol_alpha,
        payload.vol_beta
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(policy))
}

pub async fn get_capital_growth(
    State(pool): State<Pool<Postgres>>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<CapitalGrowthPolicy>, AppError> {
    let policy = sqlx::query_as!(
        CapitalGrowthPolicy,
        "SELECT * FROM capital_growth_policies WHERE plan_id = $1",
        plan_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or(AppError::NotFound("Policy not found".to_string()))?;

    Ok(Json(policy))
}
