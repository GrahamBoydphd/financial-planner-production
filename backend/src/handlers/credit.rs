use axum::{
    extract::{Path, State},
    Extension,
    Json,
};
use serde::Deserialize;
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use rust_decimal::Decimal;
use crate::models::{CreditFacility, Claims};
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct UpsertCreditRequest {
    pub plan_id: Uuid,
    pub facility_limit: Decimal,
    pub interest_rate: Decimal,
}

pub async fn upsert_credit_facility(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpsertCreditRequest>,
) -> Result<Json<CreditFacility>, AppError> {
    // Verify plan ownership first
    let _plan = sqlx::query!(
        "SELECT id FROM financial_plans WHERE id = $1 AND tenant_id = $2",
        payload.plan_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Financial plan not found".to_string()))?;

    let mut tx = pool.begin().await?;

    let _result: sqlx::postgres::PgQueryResult = sqlx::query!("DELETE FROM credit_facilities WHERE plan_id = $1", payload.plan_id)
        .execute(&mut *tx)
        .await?;

    let facility = sqlx::query_as!(
        CreditFacility,
        "INSERT INTO credit_facilities (plan_id, facility_limit, interest_rate) VALUES ($1, $2, $3) RETURNING *",
        payload.plan_id,
        payload.facility_limit,
        payload.interest_rate
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(facility))
}

pub async fn get_credit_facility(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<CreditFacility>, AppError> {
    let facility: Option<CreditFacility> = sqlx::query_as!(
        CreditFacility,
        "SELECT * FROM credit_facilities WHERE plan_id = $1 AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)",
        plan_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    let facility = facility.ok_or(AppError::NotFound("Credit facility not found".to_string()))?;

    Ok(Json(facility))
}
