use axum::{
    extract::{Path, State, Extension},
    Json,
};
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use crate::models::{Fund, CreateFundRequest, UpdateFundRequest, Claims};
use crate::errors::AppError;
use std::str::FromStr;

pub async fn create_fund(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateFundRequest>,
) -> Result<Json<Fund>, AppError> {
    let user_id = Uuid::from_str(&claims.sub)
        .map_err(|_| AppError::AuthError("Invalid user ID in token".into()))?;
    
    let currency = payload.currency_code.unwrap_or_else(|| "USD".to_string());

    let fund = sqlx::query_as!(
        Fund,
        "INSERT INTO funds (user_id, name, currency_code, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id, user_id, name, currency_code, created_at, tenant_id",
        user_id,
        payload.name,
        currency,
        claims.tenant_id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(fund))
}

pub async fn get_funds(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Fund>>, AppError> {
    let funds = sqlx::query_as!(
        Fund,
        "SELECT id, user_id, name, currency_code, created_at, tenant_id FROM funds WHERE tenant_id = $1 ORDER BY created_at DESC",
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(funds))
}

pub async fn get_fund(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Fund>, AppError> {
    let fund = sqlx::query_as!(
        Fund,
        "SELECT id, user_id, name, currency_code, created_at, tenant_id FROM funds WHERE id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    let fund = fund.ok_or(AppError::NotFound("Fund not found".to_string()))?;

    Ok(Json(fund))
}

pub async fn update_fund(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateFundRequest>,
) -> Result<Json<Fund>, AppError> {
    let fund = sqlx::query_as!(
        Fund,
        "UPDATE funds 
         SET name = $1, currency_code = $2 
         WHERE id = $3 AND tenant_id = $4 
         RETURNING id, user_id, name, currency_code, created_at, tenant_id",
        payload.name,
        payload.currency_code,
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    let fund = fund.ok_or(AppError::NotFound("Fund not found or unauthorized".to_string()))?;

    Ok(Json(fund))
}

pub async fn delete_fund(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<()>, AppError> {
    let result = sqlx::query!(
        "DELETE FROM funds WHERE id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id
    )
    .execute(&pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Fund not found or unauthorized".to_string()));
    }

    Ok(Json(()))
}
