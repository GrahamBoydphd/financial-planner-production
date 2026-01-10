use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
    Extension,
};
use sqlx::PgPool;
use uuid::Uuid;
use crate::models::{Company, CreateCompanyRequest, Claims};
use crate::errors::AppError;

// 1. GET ALL COMPANIES
pub async fn get_companies(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Company>>, AppError> {
    let companies = sqlx::query_as!(
        Company,
        "SELECT id, tenant_id, fund_id, name, created_at, business_model, industry, technology 
         FROM companies 
         WHERE tenant_id = $1
         ORDER BY created_at DESC",
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(companies))
}

// 2. GET SINGLE COMPANY
pub async fn get_company(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Company>, AppError> {
    let company = sqlx::query_as!(
        Company,
        "SELECT id, tenant_id, fund_id, name, created_at, business_model, industry, technology 
         FROM companies 
         WHERE id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(company))
}

// 3. CREATE COMPANY
pub async fn create_company(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateCompanyRequest>,
) -> Result<Json<Company>, AppError> {
    let company = sqlx::query_as!(
        Company,
        "INSERT INTO companies (tenant_id, fund_id, name, business_model, industry, technology) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING id, tenant_id, fund_id, name, created_at, business_model, industry, technology",
        claims.tenant_id,
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

// 4. DELETE COMPANY
pub async fn delete_company(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query!("DELETE FROM companies WHERE id = $1 AND tenant_id = $2", id, claims.tenant_id)
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
