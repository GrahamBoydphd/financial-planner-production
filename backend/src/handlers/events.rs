use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
    Extension,
};
use serde::{Deserialize};
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use rust_decimal::Decimal;
use crate::models::{EventShock, Claims};
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct CreateShockRequest {
    pub plan_id: Uuid,
    pub shock_name: String,
    pub shock_month: i32,
    pub impact_type: String,
    pub impact_value: Decimal,
    pub duration_months: Option<i32>,
}

pub async fn create_event_shock(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateShockRequest>,
) -> Result<Json<EventShock>, AppError> {
    // Verify plan ownership
    let plan_exists = sqlx::query!(
        "SELECT id FROM financial_plans WHERE id = $1 AND tenant_id = $2",
        payload.plan_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    if plan_exists.is_none() {
        return Err(AppError::NotFound("Financial plan not found".to_string()));
    }

    let new_shock = sqlx::query_as!(
        EventShock,
        r#"
        INSERT INTO event_shocks (plan_id, shock_name, shock_month, impact_type, impact_value, duration_months) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING 
            id as "id!", plan_id as "plan_id!", shock_name as "shock_name!", 
            shock_month as "shock_month!", impact_type as "impact_type!", 
            impact_value as "impact_value!", duration_months, created_at as "created_at!"
        "#,
        payload.plan_id,
        payload.shock_name,
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
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<EventShock>, AppError> {
    let shock = sqlx::query_as!(
        EventShock,
        r#"
        SELECT 
            id as "id!", plan_id as "plan_id!", shock_name as "shock_name!", 
            shock_month as "shock_month!", impact_type as "impact_type!", 
            impact_value as "impact_value!", duration_months, created_at as "created_at!" 
        FROM event_shocks 
        WHERE id = $1 AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        "#,
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or(AppError::NotFound("Event shock not found".to_string()))?;

    Ok(Json(shock))
}

pub async fn get_plan_event_shocks(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<Vec<EventShock>>, AppError> {
    let shocks = sqlx::query_as!(
        EventShock,
        r#"
        SELECT 
            id as "id!", plan_id as "plan_id!", shock_name as "shock_name!", 
            shock_month as "shock_month!", impact_type as "impact_type!", 
            impact_value as "impact_value!", duration_months, created_at as "created_at!" 
        FROM event_shocks 
        WHERE plan_id = $1 AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        "#,
        plan_id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(shocks))
}

pub async fn delete_event_shock(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query!(
        "DELETE FROM event_shocks WHERE id = $1 AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)",
        id,
        claims.tenant_id
    )
    .execute(&pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Event shock not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
