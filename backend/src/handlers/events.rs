use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize};
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use rust_decimal::Decimal;
use crate::models::EventShock;
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct CreateShockRequest {
    pub plan_id: Uuid,
    pub name: String,
    pub shock_month: i32,
    pub impact_type: String,
    pub impact_value: Decimal,
    pub duration_months: Option<i32>,
}

pub async fn create_event_shock(
    State(pool): State<Pool<Postgres>>,
    Json(payload): Json<CreateShockRequest>,
) -> Result<Json<EventShock>, AppError> {
    let new_shock = sqlx::query_as!(
        EventShock,
        "INSERT INTO event_shocks (plan_id, name, shock_month, impact_type, impact_value, duration_months) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, plan_id, name, shock_month, impact_type, impact_value, duration_months",
        payload.plan_id,
        payload.name,
        payload.shock_month,
        payload.impact_type,
        payload.impact_value,
        payload.duration_months
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(new_shock))
}

pub async fn get_event_shock(
    State(pool): State<Pool<Postgres>>,
    Path(id): Path<Uuid>,
) -> Result<Json<EventShock>, AppError> {
    let shock = sqlx::query_as!(
        EventShock,
        "SELECT id, plan_id, name, shock_month, impact_type, impact_value, duration_months FROM event_shocks WHERE id = $1",
        id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or(AppError::NotFound("Event shock not found".to_string()))?; // Fixed

    Ok(Json(shock))
}

pub async fn get_plan_event_shocks(
    State(pool): State<Pool<Postgres>>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<Vec<EventShock>>, AppError> {
    let shocks = sqlx::query_as!(
        EventShock,
        "SELECT id, plan_id, name, shock_month, impact_type, impact_value, duration_months FROM event_shocks WHERE plan_id = $1",
        plan_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(shocks))
}

pub async fn delete_event_shock(
    State(pool): State<Pool<Postgres>>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query!("DELETE FROM event_shocks WHERE id = $1", id)
        .execute(&pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Event shock not found".to_string())); // Fixed
    }

    Ok(StatusCode::NO_CONTENT)
}
