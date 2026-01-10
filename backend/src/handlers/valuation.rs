use axum::{
    extract::{State, Extension, Path},
    Json,
    http::StatusCode,
};
use serde::Deserialize;
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use rust_decimal::Decimal;
use crate::models::{ValuationAssumption, Claims};
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct CreateValuationRequest {
    pub plan_id: Uuid,
    pub name: String,
    pub method: String,
    pub multiplier: Decimal,
    pub date_applied: Option<chrono::NaiveDate>,
}

#[derive(Deserialize)]
pub struct UpdateValuationRequest {
    pub name: Option<String>,
    pub method: Option<String>,
    pub multiplier: Option<Decimal>,
    pub date_applied: Option<chrono::NaiveDate>,
}

pub async fn create_valuation_assumption(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateValuationRequest>,
) -> Result<Json<ValuationAssumption>, AppError> {
    // 1. Verify plan ownership
    let plan_exists = sqlx::query!(
        "SELECT id FROM financial_plans WHERE id = $1 AND tenant_id = $2",
        payload.plan_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    if plan_exists.is_none() {
        return Err(AppError::NotFound("Financial Plan not found or access denied".into()));
    }

    // 2. Delete existing assumption for this plan so we only have one active
    // We can safely delete by plan_id now that we verified ownership
    sqlx::query!(
        "DELETE FROM valuation_assumptions WHERE plan_id = $1",
        payload.plan_id
    )
    .execute(&pool)
    .await?;

    // 3. Insert new assumption
    let new_assumption = sqlx::query_as!(
        ValuationAssumption,
        "INSERT INTO valuation_assumptions (plan_id, name, method, multiplier, date_applied) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, plan_id, name, method, multiplier, date_applied",
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

pub async fn get_valuation_assumptions(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<Vec<ValuationAssumption>>, AppError> {
    let assumptions = sqlx::query_as!(
        ValuationAssumption,
        "SELECT * FROM valuation_assumptions 
         WHERE plan_id = $1 
         AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
         ORDER BY date_applied ASC",
        plan_id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(assumptions))
}

pub async fn get_valuation_assumption(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<ValuationAssumption>, AppError> {
    let assumption = sqlx::query_as!(
        ValuationAssumption,
        "SELECT * FROM valuation_assumptions 
         WHERE plan_id = $1 
         AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)",
        plan_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    match assumption {
        Some(a) => Ok(Json(a)),
        None => Err(AppError::NotFound("Valuation assumption not found".into())),
    }
}

pub async fn update_valuation_assumption(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateValuationRequest>,
) -> Result<Json<ValuationAssumption>, AppError> {
    let updated = sqlx::query_as!(
        ValuationAssumption,
        "UPDATE valuation_assumptions 
         SET name = COALESCE($1, name),
             method = COALESCE($2, method),
             multiplier = COALESCE($3, multiplier),
             date_applied = COALESCE($4, date_applied)
         WHERE id = $5 
         AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $6)
         RETURNING id, plan_id, name, method, multiplier, date_applied",
        payload.name,
        payload.method,
        payload.multiplier,
        payload.date_applied,
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    match updated {
        Some(v) => Ok(Json(v)),
        None => Err(AppError::NotFound("Valuation assumption not found or access denied".into())),
    }
}

pub async fn delete_valuation_assumption(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query!(
        "DELETE FROM valuation_assumptions 
         WHERE id = $1 
         AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)",
        id,
        claims.tenant_id
    )
    .execute(&pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Valuation assumption not found or access denied".into()));
    }

    Ok(StatusCode::NO_CONTENT)
}
