use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;
use crate::models::{FundPlan, CreateFundPlanRequest};

/// Create a new Fund Plan Configuration
pub async fn create_fund_plan(
    State(pool): State<PgPool>,
    Extension(claims): Extension<crate::models::Claims>,
    Path(fund_id): Path<Uuid>,
    Json(payload): Json<CreateFundPlanRequest>,
) -> Result<Json<FundPlan>, (StatusCode, String)> {
    let plan = sqlx::query_as!(
        FundPlan,
        r#"
        INSERT INTO fund_plans (fund_id, plan_name, selected_plans, tenant_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, fund_id, plan_name, selected_plans, tenant_id, created_at, updated_at
        "#,
        fund_id,
        payload.plan_name,
        payload.selected_plans,
        claims.tenant_id
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(plan))
}

/// Get all Plans for a specific Fund
pub async fn get_fund_plans(
    State(pool): State<PgPool>,
    Extension(claims): Extension<crate::models::Claims>,
    Path(fund_id): Path<Uuid>,
) -> Result<Json<Vec<FundPlan>>, (StatusCode, String)> {
    let plans = sqlx::query_as!(
        FundPlan,
        r#"
        SELECT id, fund_id, plan_name, selected_plans, tenant_id, created_at, updated_at
        FROM fund_plans
        WHERE fund_id = $1 AND tenant_id = $2
        ORDER BY created_at DESC
        "#,
        fund_id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(plans))
}

/// Get a single Fund Plan by ID
pub async fn get_fund_plan(
    State(pool): State<PgPool>,
    Extension(claims): Extension<crate::models::Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<FundPlan>, (StatusCode, String)> {
    let plan = sqlx::query_as!(
        FundPlan,
        r#"
        SELECT id, fund_id, plan_name, selected_plans, tenant_id, created_at, updated_at
        FROM fund_plans
        WHERE id = $1 AND tenant_id = $2
        "#,
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Fund Plan not found".to_string()))?;

    Ok(Json(plan))
}

/// Update a Fund Plan (Name or Selection)
pub async fn update_fund_plan(
    State(pool): State<PgPool>,
    Extension(claims): Extension<crate::models::Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateFundPlanRequest>,
) -> Result<Json<FundPlan>, (StatusCode, String)> {
    let plan = sqlx::query_as!(
        FundPlan,
        r#"
        UPDATE fund_plans
        SET plan_name = $1, selected_plans = $2, updated_at = NOW()
        WHERE id = $3 AND tenant_id = $4
        RETURNING id, fund_id, plan_name, selected_plans, tenant_id, created_at, updated_at
        "#,
        payload.plan_name,
        payload.selected_plans,
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Fund Plan not found".to_string()))?;

    Ok(Json(plan))
}

/// Delete a Fund Plan
pub async fn delete_fund_plan(
    State(pool): State<PgPool>,
    Extension(claims): Extension<crate::models::Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query!(
        "DELETE FROM fund_plans WHERE id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id
    )
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Fund Plan not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
