use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use rust_decimal::Decimal;
use crate::models::DividendPolicy;
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct UpsertDividendRequest {
    pub plan_id: Uuid,
    pub is_enabled: bool,
    pub safety_threshold: Decimal,
    pub payout_ratio: Decimal,
}

pub async fn upsert_dividend_policy(
    State(pool): State<Pool<Postgres>>,
    Json(payload): Json<UpsertDividendRequest>,
) -> Result<Json<DividendPolicy>, AppError> {
    let mut tx = pool.begin().await?;

    sqlx::query!("DELETE FROM dividend_policies WHERE plan_id = $1", payload.plan_id)
        .execute(&mut *tx)
        .await?;

    let policy = sqlx::query_as!(
        DividendPolicy,
        "INSERT INTO dividend_policies (plan_id, is_enabled, safety_threshold, payout_ratio) VALUES ($1, $2, $3, $4) RETURNING *",
        payload.plan_id,
        payload.is_enabled,
        payload.safety_threshold,
        payload.payout_ratio
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(policy))
}

pub async fn get_dividend_policy(
    State(pool): State<Pool<Postgres>>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<DividendPolicy>, AppError> {
    let policy = sqlx::query_as!(
        DividendPolicy,
        "SELECT * FROM dividend_policies WHERE plan_id = $1",
        plan_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or(AppError::NotFound("Dividend policy not found".to_string()))?;

    Ok(Json(policy))
}
