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
    pub name: String,
    pub amount: Decimal,
    pub month: i32,
}

pub async fn create_capital_injection(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateCapitalRequest>,
) -> Result<Json<CapitalInjection>, AppError> {
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
        "INSERT INTO capital_injections (plan_id, name, amount, month) VALUES ($1, $2, $3, $4) RETURNING *",
        payload.plan_id,
        payload.name,
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
        SELECT * FROM capital_injections 
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
