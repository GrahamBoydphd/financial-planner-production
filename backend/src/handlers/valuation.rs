use axum::{
    extract::{Path, State},
    Extension,
    Json,
};
use serde::Deserialize;
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use rust_decimal::Decimal;
use chrono::NaiveDate;
use crate::models::{ValuationAssumption, Claims};
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct UpsertValuationRequest {
    pub plan_id: Uuid,
    pub valuation_name: String,
    pub method: String,
    pub multiplier: Decimal,
    pub date_applied: NaiveDate,
}

pub async fn upsert_valuation_assumption(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpsertValuationRequest>,
) -> Result<Json<ValuationAssumption>, AppError> {
    // Length Validation
    if payload.valuation_name.len() > 255 {
        return Err(AppError::ValidationError("Valuation name exceeds 255 characters".to_string()));
    }
    if payload.method.len() > 255 {
        return Err(AppError::ValidationError("Method name exceeds 255 characters".to_string()));
    }

    // Verify plan ownership first
    let plan_exists: Option<_> = sqlx::query!(
        "SELECT id FROM financial_plans WHERE id = $1 AND tenant_id = $2",
        payload.plan_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    if plan_exists.is_none() {
        return Err(AppError::NotFound("Financial plan not found".to_string()));
    }

    let mut tx = pool.begin().await?;

    // Clear existing assumption for this plan to ensure 1:1 relationship
    let _result = sqlx::query!(
        "DELETE FROM valuation_assumptions WHERE plan_id = $1", 
        payload.plan_id
    )
    .execute(&mut *tx)
    .await?;

    // Insert new assumption with strict column mapping
    let assumption = sqlx::query_as!(
        ValuationAssumption,
        r#"
        INSERT INTO valuation_assumptions (plan_id, valuation_name, method, multiplier, date_applied) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING 
            id as "id!", 
            plan_id as "plan_id!", 
            valuation_name as "valuation_name!", 
            method as "method!", 
            multiplier as "multiplier!", 
            date_applied as "date_applied!", 
            created_at as "created_at!"
        "#,
        payload.plan_id,
        payload.valuation_name,
        payload.method,
        payload.multiplier,
        payload.date_applied
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(assumption))
}

pub async fn get_valuation_assumption(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<ValuationAssumption>, AppError> {
    let assumption = sqlx::query_as!(
        ValuationAssumption,
        r#"
        SELECT 
            id as "id!", 
            plan_id as "plan_id!", 
            valuation_name as "valuation_name!", 
            method as "method!", 
            multiplier as "multiplier!", 
            date_applied as "date_applied!", 
            created_at as "created_at!" 
        FROM valuation_assumptions 
        WHERE plan_id = $1 
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        "#,
        plan_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    let assumption = assumption.ok_or(AppError::NotFound("Valuation assumption not found".to_string()))?;

    Ok(Json(assumption))
}
