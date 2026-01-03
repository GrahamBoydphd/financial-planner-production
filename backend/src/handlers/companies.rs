use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;
use crate::models::{Company, CreateCompanyRequest};
use crate::errors::AppError;

// 1. GET ALL COMPANIES
pub async fn get_companies(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Company>>, AppError> {
    // RESTORED: Selecting V2 fields (business_model, industry, technology)
    let companies = sqlx::query_as!(
        Company,
        "SELECT id, fund_id, name, created_at, business_model, industry, technology 
         FROM companies 
         ORDER BY created_at DESC"
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(companies))
}

// 2. GET SINGLE COMPANY
pub async fn get_company(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Company>, AppError> {
    // RESTORED: Selecting V2 fields
    let company = sqlx::query_as!(
        Company,
        "SELECT id, fund_id, name, created_at, business_model, industry, technology 
         FROM companies 
         WHERE id = $1",
        id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(company))
}

// 3. CREATE COMPANY
pub async fn create_company(
    State(pool): State<PgPool>,
    Json(payload): Json<CreateCompanyRequest>,
) -> Result<Json<Company>, AppError> {
    // RESTORED: Inserting and Returning V2 fields
    let company = sqlx::query_as!(
        Company,
        "INSERT INTO companies (fund_id, name, business_model, industry, technology) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, fund_id, name, created_at, business_model, industry, technology",
        payload.fund_id,
        payload.name,
        payload.business_model,
        payload.industry,
        payload.technology
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(company))
}

// 4. DELETE COMPANY (The new feature for today)
pub async fn delete_company(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query!("DELETE FROM companies WHERE id = $1", id)
        .execute(&pool)
        .await;

    match result {
        Ok(_) => StatusCode::NO_CONTENT,
        Err(e) => {
            eprintln!("Failed to delete company: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}
