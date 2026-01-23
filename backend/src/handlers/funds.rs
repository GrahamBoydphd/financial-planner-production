use axum::{
    extract::{Path, State, Extension, Query},
    Json,
};
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use crate::models::{Fund, CreateFundRequest, UpdateFundRequest, Claims, FundPlan};
use crate::errors::AppError;
use serde::Deserialize;
use std::collections::HashMap;
use serde_json::json;

pub async fn create_fund(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateFundRequest>,
) -> Result<Json<Fund>, AppError> {
    // Use user_id directly from claims, do not parse sub (which is username)
    let user_id = claims.user_id;
    
    let currency = payload.currency_code.unwrap_or_else(|| "USD".to_string());

    let fund = sqlx::query_as!(
        Fund,
        "INSERT INTO funds (user_id, fund_name, currency_code, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id, user_id, fund_name, currency_code, created_at, tenant_id",
        user_id,
        payload.fund_name,
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
        "SELECT id, user_id, fund_name, currency_code, created_at, tenant_id FROM funds WHERE tenant_id = $1 ORDER BY created_at DESC",
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
        "SELECT id, user_id, fund_name, currency_code, created_at, tenant_id FROM funds WHERE id = $1 AND tenant_id = $2",
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
         SET fund_name = $1, currency_code = $2 
         WHERE id = $3 AND tenant_id = $4 
         RETURNING id, user_id, fund_name, currency_code, created_at, tenant_id",
        payload.fund_name,
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
    // Check if any companies exist for this fund
    let companies_exist = sqlx::query!(
        "SELECT id FROM companies WHERE fund_id = $1 AND tenant_id = $2 LIMIT 1",
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    if companies_exist.is_some() {
        return Err(AppError::ValidationError("Cannot delete fund with existing companies. Please delete companies first.".to_string()));
    }

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

#[derive(Deserialize)]
pub struct SimParams {
    pub fund_plan_id: Option<Uuid>,
}

pub async fn get_fund_simulation(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Query(params): Query<SimParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    // 1. Fetch all companies for the fund
    let companies = sqlx::query!(
        "SELECT id, company_name FROM companies WHERE fund_id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    // 2. Load selected_plans map if fund_plan_id is provided
    let mut selected_plans: HashMap<String, Uuid> = HashMap::new();

    if let Some(plan_id) = params.fund_plan_id {
        let fund_plan_record = sqlx::query!(
            r#"SELECT selected_plans as "selected_plans!" FROM fund_plans WHERE id = $1 AND tenant_id = $2"#,
            plan_id,
            claims.tenant_id
        )
        .fetch_optional(&pool)
        .await?;

        if let Some(record) = fund_plan_record {
            if let Ok(map) = serde_json::from_value::<HashMap<String, Uuid>>(record.selected_plans) {
                selected_plans = map;
            }
        }
    }

    let mut manifest = Vec::new();
    let mut errors = Vec::new();

    // 3. Loop through companies
    for company in companies {
        let company_id_str = company.id.to_string();
        let mut final_plan_id: Option<Uuid> = None;
        let mut source = "latest_auto";

        // a) Check if a plan is selected in the map
        if let Some(selected_id) = selected_plans.get(&company_id_str) {
            final_plan_id = Some(*selected_id);
            source = "fund_plan_override";
        } else {
            // b) If not, query the DB for the LATEST plan
            let latest_plan = sqlx::query!(
                "SELECT id FROM financial_plans WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1",
                company.id
            )
            .fetch_optional(&pool)
            .await?;

            if let Some(plan) = latest_plan {
                final_plan_id = Some(plan.id);
            }
        }

        // c) & d) Add to manifest or errors
        match final_plan_id {
            Some(pid) => {
                manifest.push(json!({
                    "company_name": company.company_name,
                    "company_id": company.id,
                    "plan_id": pid,
                    "source": source
                }));
            }
            None => {
                errors.push(format!("Company {} has no financial plans.", company.company_name));
            }
        }
    }

    // Return JSON
    Ok(Json(json!({
        "fund_id": id,
        "manifest": manifest,
        "errors": errors
    })))
}
