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
    // 1. Validate Currency Code
    let currency = payload.currency_code.clone().unwrap_or_else(|| "USD".to_string());
    if currency.len() != 3 {
        return Err(AppError::ValidationError("Currency code must be exactly 3 characters".to_string()));
    }

    // 2. Verify that the fund exists and belongs to the tenant (Ownership Check)
    let fund_exists = sqlx::query!(
        "SELECT id FROM funds WHERE id = $1 AND tenant_id = $2",
        payload.fund_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    if fund_exists.is_none() {
        return Err(AppError::ValidationError("Fund not found or unauthorized".to_string()));
    }

    // 3. Insert Company with Database Constraint Handling
    let company = sqlx::query_as!(
        Company,
        "INSERT INTO companies (fund_id, company_name, currency_code, industry, business_model, technology, tenant_id, description) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id, fund_id, company_name, description, currency_code, created_at, industry, business_model, technology, tenant_id",
        payload.fund_id,
        payload.company_name,
        currency,
        payload.industry,
        payload.business_model,
        payload.technology,
        claims.tenant_id,
        payload.description
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        if let Some(db_err) = e.as_database_error() {
            // Handle Unique Constraint Violation (e.g., duplicate name)
            if db_err.code().as_deref() == Some("23505") {
                return AppError::ValidationError("Company name already exists in this fund".to_string());
            }
            // Handle Foreign Key Violation (e.g., invalid fund_id if check above failed somehow)
            if db_err.code().as_deref() == Some("23503") {
                return AppError::ValidationError("Invalid fund reference".to_string());
            }
        }
        AppError::InternalServerError(e.to_string())
    })?;

    Ok(Json(company))
}

pub async fn get_companies(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Company>>, AppError> {
    let companies = sqlx::query_as!(
        Company,
        "SELECT id, fund_id, company_name, description, currency_code, created_at, industry, business_model, technology, tenant_id 
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
        "SELECT id, fund_id, company_name, description, currency_code, created_at, industry, business_model, technology, tenant_id 
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
    // Validate Currency Code
    if payload.currency_code.len() != 3 {
        return Err(AppError::ValidationError("Currency code must be exactly 3 characters".to_string()));
    }

    let company = sqlx::query_as!(
        Company,
        "UPDATE companies 
         SET company_name = $1, currency_code = $2, industry = $3, business_model = $4, technology = $5, description = COALESCE($6, description)
         WHERE id = $7 AND tenant_id = $8
         RETURNING id, fund_id, company_name, description, currency_code, created_at, industry, business_model, technology, tenant_id",
        payload.company_name,
        payload.currency_code,
        payload.industry,
        payload.business_model,
        payload.technology,
        payload.description,
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        if let Some(db_err) = e.as_database_error() {
            if db_err.code().as_deref() == Some("23505") {
                return AppError::ValidationError("Company name already exists".to_string());
            }
        }
        AppError::InternalServerError(e.to_string())
    })?;

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
