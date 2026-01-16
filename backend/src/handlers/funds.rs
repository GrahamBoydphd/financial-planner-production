use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
    Extension,
};
use sqlx::PgPool;
use uuid::Uuid;
use crate::models::{Fund, CreateFundRequest, Claims};
use crate::errors::AppError;

pub async fn get_funds(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Fund>>, AppError> {
    let funds = sqlx::query_as!(
        Fund,
        "SELECT id, tenant_id, user_id, name, created_at FROM funds WHERE tenant_id = $1 ORDER BY created_at DESC",
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(funds))
}

pub async fn create_fund(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateFundRequest>,
) -> Result<Json<Fund>, AppError> {
    // Get user_id from username in claims
    let user = sqlx::query!(
        "SELECT id FROM users WHERE username = $1",
        claims.sub
    )
    .fetch_one(&pool)
    .await?;

    let fund = sqlx::query_as!(
        Fund,
        "INSERT INTO funds (tenant_id, user_id, name) VALUES ($1, $2, $3) RETURNING id, tenant_id, user_id, name, created_at",
        claims.tenant_id,
        user.id,
        payload.name
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(fund))
}

pub async fn delete_fund(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query!("DELETE FROM funds WHERE id = $1 AND tenant_id = $2", id, claims.tenant_id)
        .execute(&pool)
        .await;

    match result {
        Ok(_) => StatusCode::NO_CONTENT,
        Err(e) => {
            eprintln!("Failed to delete fund: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

pub async fn get_fund(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Fund>, AppError> {
    let fund = sqlx::query_as!(
        Fund,
        "SELECT id, tenant_id, user_id, name, created_at FROM funds WHERE id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(fund))
}
