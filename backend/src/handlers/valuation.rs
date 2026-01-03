use axum::{
    extract::{State},
    Json,
};
use serde::{Deserialize};
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use rust_decimal::Decimal;
use crate::models::ValuationAssumption;
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct CreateValuationRequest {
    pub plan_id: Uuid,
    pub name: String,
    pub method: String,
    pub multiplier: Decimal,
    pub date_applied: Option<chrono::NaiveDate>,
}

pub async fn create_valuation_assumption(
    State(pool): State<Pool<Postgres>>,
    Json(payload): Json<CreateValuationRequest>,
) -> Result<Json<ValuationAssumption>, AppError> {
    // Optional: Delete existing assumption for this plan so we only have one active
    sqlx::query!("DELETE FROM valuation_assumptions WHERE plan_id = $1", payload.plan_id)
        .execute(&pool)
        .await?;

    let new_assumption = sqlx::query_as!(
        ValuationAssumption,
        "INSERT INTO valuation_assumptions (plan_id, name, method, multiplier, date_applied) VALUES ($1, $2, $3, $4, $5) RETURNING id, plan_id, name, method, multiplier, date_applied",
        payload.plan_id,
        payload.name,
        payload.method,
        payload.multiplier,
        payload.date_applied
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(new_assumption))
}
