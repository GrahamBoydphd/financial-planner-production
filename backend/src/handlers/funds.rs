use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;
use crate::models::{Fund, CreateFundRequest};
use crate::errors::AppError;

pub async fn get_funds(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Fund>>, AppError> {
    let funds = sqlx::query_as!(
        Fund,
        "SELECT id, user_id, name, created_at FROM funds ORDER BY created_at DESC"
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(funds))
}

pub async fn create_fund(
    State(pool): State<PgPool>,
    Json(payload): Json<CreateFundRequest>,
) -> Result<Json<Fund>, AppError> {
    let fund = sqlx::query_as!(
        Fund,
        "INSERT INTO funds (user_id, name) VALUES ($1, $2) RETURNING id, user_id, name, created_at",
        Uuid::nil(), // Placeholder for user_id until Auth is added
        payload.name
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(fund))
}

pub async fn delete_fund(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query!("DELETE FROM funds WHERE id = $1", id)
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

// Add to the bottom of handlers/funds.rs

pub async fn get_fund(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Fund>, AppError> {
    let fund = sqlx::query_as!(
        Fund,
        "SELECT id, user_id, name, created_at FROM funds WHERE id = $1",
        id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(fund))
}
