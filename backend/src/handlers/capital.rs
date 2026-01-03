use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use rust_decimal::Decimal;
use crate::models::CapitalInjection;
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct CreateCapitalRequest {
    pub plan_id: Uuid,
    pub name: String,
    pub amount: Decimal,
    pub month: i32,
}

pub async fn create_capital_injection(
    State(pool): State<Pool<Postgres>>,
    Json(payload): Json<CreateCapitalRequest>,
) -> Result<Json<CapitalInjection>, AppError> {
    let item = sqlx::query_as!(
        CapitalInjection,
        "INSERT INTO capital_injections (plan_id, name, amount, month) VALUES ($1, $2, $3, $4) RETURNING *",
        payload.plan_id,
        payload.name,
        payload.amount,
        payload.month
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(item))
}

pub async fn get_capital_injections(
    State(pool): State<Pool<Postgres>>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<Vec<CapitalInjection>>, AppError> {
    let items = sqlx::query_as!(
        CapitalInjection,
        "SELECT * FROM capital_injections WHERE plan_id = $1 ORDER BY month ASC",
        plan_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(items))
}

pub async fn delete_capital_injection(
    State(pool): State<Pool<Postgres>>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query!("DELETE FROM capital_injections WHERE id = $1", id)
        .execute(&pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Capital injection not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
