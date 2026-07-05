use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use rust_decimal::Decimal;
use crate::models::{CapitalInjection, Claims};
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct CreateCapitalRequest {
    pub plan_id: Uuid,
    pub injection_name: String,
    pub amount: Decimal,
    pub month: i32,
}

#[derive(Deserialize)]
pub struct UpdateCapitalRequest {
    pub injection_name: String,
    pub amount: Decimal,
    pub month: i32,
}

pub async fn create_capital_injection(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateCapitalRequest>,
) -> Result<Json<CapitalInjection>, AppError> {
    // Length Validation
    if payload.injection_name.len() > 255 {
        return Err(AppError::ValidationError("Name exceeds 255 characters".to_string()));
    }

    // Verify plan ownership
    let plan_exists = sqlx::query!(
        "SELECT id FROM financial_plans WHERE id = $1 AND tenant_id = $2",
        payload.plan_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    if plan_exists.is_none() {
        return Err(AppError::NotFound("Financial plan not found".to_string()));
    }

    let item = sqlx::query_as!(
        CapitalInjection,
        r#"
        INSERT INTO capital_injections (plan_id, injection_name, amount, month) 
        VALUES ($1, $2, $3, $4) 
        RETURNING 
            id as "id!", plan_id as "plan_id!", injection_name as "injection_name!", 
            amount as "amount!", month as "month!", created_at as "created_at!"
        "#,
        payload.plan_id,
        payload.injection_name,
        payload.amount,
        payload.month
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(item))
}

pub async fn get_capital_injections(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<Vec<CapitalInjection>>, AppError> {
    let items = sqlx::query_as!(
        CapitalInjection,
        r#"
        SELECT 
            id as "id!", plan_id as "plan_id!", injection_name as "injection_name!", 
            amount as "amount!", month as "month!", created_at as "created_at!"
        FROM capital_injections 
        WHERE plan_id = $1 
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2) 
        ORDER BY month ASC
        "#,
        plan_id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(items))
}

pub async fn delete_capital_injection(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query!(
        r#"
        DELETE FROM capital_injections 
        WHERE id = $1 
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        "#,
        id,
        claims.tenant_id
    )
    .execute(&pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Capital injection not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn update_capital_injection(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCapitalRequest>,
) -> Result<Json<CapitalInjection>, AppError> {
    if payload.injection_name.len() > 255 {
        return Err(AppError::ValidationError("Name exceeds 255 characters".to_string()));
    }
    
    let item = sqlx::query_as!(
        CapitalInjection,
        r#"
        UPDATE capital_injections 
        SET injection_name = $1, amount = $2, month = $3 
        WHERE id = $4 
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $5)
        RETURNING 
            id as "id!", plan_id as "plan_id!", injection_name as "injection_name!", 
            amount as "amount!", month as "month!", created_at as "created_at!"
        "#,
        payload.injection_name,
        payload.amount,
        payload.month,
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Capital injection not found or unauthorized".to_string()))?;
    
    Ok(Json(item))
}
