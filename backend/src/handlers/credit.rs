use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use rust_decimal::Decimal;
use crate::models::CreditFacility;
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct UpsertCreditRequest {
    pub plan_id: Uuid,
    pub facility_limit: Decimal,
    pub interest_rate: Decimal,
    pub is_annual_rate: bool,
}

pub async fn upsert_credit_facility(
    State(pool): State<Pool<Postgres>>,
    Json(payload): Json<UpsertCreditRequest>,
) -> Result<Json<CreditFacility>, AppError> {
    let mut tx = pool.begin().await?;

    sqlx::query!("DELETE FROM credit_facilities WHERE plan_id = $1", payload.plan_id)
        .execute(&mut *tx)
        .await?;

    let facility = sqlx::query_as!(
        CreditFacility,
        "INSERT INTO credit_facilities (plan_id, facility_limit, interest_rate, is_annual_rate) VALUES ($1, $2, $3, $4) RETURNING *",
        payload.plan_id,
        payload.facility_limit,
        payload.interest_rate,
        payload.is_annual_rate
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(facility))
}

pub async fn get_credit_facility(
    State(pool): State<Pool<Postgres>>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<CreditFacility>, AppError> {
    let facility = sqlx::query_as!(
        CreditFacility,
        "SELECT * FROM credit_facilities WHERE plan_id = $1",
        plan_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or(AppError::NotFound("Credit facility not found".to_string()))?;

    Ok(Json(facility))
}
