use axum::{
    extract::{Path, State, Extension},
    Json,
};
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use crate::models::{Company, CreateCompanyRequest, UpdateCompanyRequest, Claims};
use crate::errors::AppError;

pub async fn create_company(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateCompanyRequest>,
) -> Result<Json<Company>, AppError> {
    let currency = payload.currency_code.unwrap_or_else(|| "USD".to_string());

    let company = sqlx::query_as!(
        Company,
        "INSERT INTO companies (fund_id, name, currency_code, industry, business_model, technology, tenant_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id, fund_id, name, currency_code, created_at, industry, business_model, technology, tenant_id",
        payload.fund_id,
        payload.name,
        currency,
        payload.industry,
        payload.business_model,
        payload.technology,
        claims.tenant_id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(company))
}

pub async fn get_companies(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Company>>, AppError> {
    let companies = sqlx::query_as!(
        Company,
        "SELECT id, fund_id, name, currency_code, created_at, industry, business_model, technology, tenant_id 
         FROM companies WHERE tenant_id = $1 ORDER BY created_at DESC",
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(companies))
}

pub async fn get_company(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Company>, AppError> {
    let company = sqlx::query_as!(
        Company,
        "SELECT id, fund_id, name, currency_code, created_at, industry, business_model, technology, tenant_id 
         FROM companies WHERE id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    let company = company.ok_or(AppError::NotFound("Company not found".to_string()))?;

    Ok(Json(company))
}

pub async fn update_company(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCompanyRequest>,
) -> Result<Json<Company>, AppError> {
    let company = sqlx::query_as!(
        Company,
        "UPDATE companies 
         SET name = $1, currency_code = $2, industry = $3, business_model = $4, technology = $5
         WHERE id = $6 AND tenant_id = $7
         RETURNING id, fund_id, name, currency_code, created_at, industry, business_model, technology, tenant_id",
        payload.name,
        payload.currency_code,
        payload.industry,
        payload.business_model,
        payload.technology,
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    let company = company.ok_or(AppError::NotFound("Company not found or unauthorized".to_string()))?;

    Ok(Json(company))
}

pub async fn delete_company(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<()>, AppError> {
    let result = sqlx::query!(
        "DELETE FROM companies WHERE id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id
    )
    .execute(&pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Company not found or unauthorized".to_string()));
    }

    Ok(Json(()))
}
