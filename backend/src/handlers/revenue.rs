use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
    Extension,
};
use serde::Deserialize;
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use crate::models::{RevenueItem, Claims};
use crate::errors::AppError;
use rust_decimal::Decimal;

#[derive(Deserialize)]
pub struct CreateRevenueRequest {
    pub plan_id: Uuid,
    pub name: String,
    pub source: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: Decimal,
    pub growth_rate_percent: Decimal,
    pub frequency: String,
    pub cost_of_revenue_percent: Option<Decimal>,
    pub volatility_type: Option<String>,
    pub vol_min: Option<Decimal>,
    pub vol_max: Option<Decimal>,
    pub vol_intervals: Option<i32>,
    pub vol_mean: Option<Decimal>,
    pub vol_scale: Option<Decimal>,
    pub vol_freedom: Option<Decimal>,
    pub vol_alpha: Option<Decimal>,
    pub vol_beta: Option<Decimal>,
}

pub async fn create_revenue_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateRevenueRequest>,
) -> Result<Json<RevenueItem>, AppError> {
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

    let item = sqlx::query_as!(
        RevenueItem,
        r#"
        INSERT INTO revenue_items (
            plan_id, name, source, start_month, end_month, initial_amount, growth_rate_percent, frequency, cost_of_revenue_percent,
            volatility_type, vol_min, vol_max, vol_intervals, vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
        "#,
        payload.plan_id, payload.name, payload.source, payload.start_month, payload.end_month, 
        payload.initial_amount, payload.growth_rate_percent, payload.frequency, payload.cost_of_revenue_percent,
        payload.volatility_type, payload.vol_min, payload.vol_max, payload.vol_intervals,
        payload.vol_mean, payload.vol_scale, payload.vol_freedom, payload.vol_alpha, payload.vol_beta
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(item))
}

pub async fn get_revenue_items(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<Vec<RevenueItem>>, AppError> {
    let items = sqlx::query_as!(
        RevenueItem,
        r#"
        SELECT * FROM revenue_items 
        WHERE plan_id = $1 
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        ORDER BY start_month ASC
        "#,
        plan_id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(items))
}

pub async fn update_revenue_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateRevenueRequest>,
) -> Result<Json<RevenueItem>, AppError> {
    let item = sqlx::query_as!(
        RevenueItem,
        r#"
        UPDATE revenue_items SET
            name = $1, source = $2, start_month = $3, end_month = $4,
            initial_amount = $5, growth_rate_percent = $6, frequency = $7, cost_of_revenue_percent = $8,
            volatility_type = $9, vol_min = $10, vol_max = $11, vol_intervals = $12,
            vol_mean = $13, vol_scale = $14, vol_freedom = $15, vol_alpha = $16, vol_beta = $17
        WHERE id = $18
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $19)
        RETURNING *
        "#,
        payload.name, payload.source, payload.start_month, payload.end_month, 
        payload.initial_amount, payload.growth_rate_percent, payload.frequency, payload.cost_of_revenue_percent,
        payload.volatility_type, payload.vol_min, payload.vol_max, payload.vol_intervals,
        payload.vol_mean, payload.vol_scale, payload.vol_freedom, payload.vol_alpha, payload.vol_beta,
        id,
        claims.tenant_id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(item))
}

pub async fn delete_revenue_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query!(
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
