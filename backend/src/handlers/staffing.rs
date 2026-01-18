use axum::{
    extract::{Path, State, Extension},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;
use sqlx::{Pool, Postgres};
use rust_decimal::Decimal;
use crate::models::{StaffingRole, Claims};
use crate::errors::AppError;
use std::str::FromStr;

#[derive(Deserialize)]
pub struct CreateStaffingRoleRequest {
    pub plan_id: Uuid,
    pub role_name: String,
    pub annual_salary: String,
    pub start_month: i32,
    pub target_count: i32,
    pub hiring_plan: String,
    pub hiring_rate: Option<i32>,
    pub annual_increase_percent: String,
}

#[derive(Deserialize)]
pub struct UpdateStaffingRoleRequest {
    pub role_name: Option<String>,
    pub annual_salary: Option<String>,
    pub start_month: Option<i32>,
    pub target_count: Option<i32>,
    pub hiring_plan: Option<String>,
    pub hiring_rate: Option<i32>,
    pub annual_increase_percent: Option<String>,
}

pub async fn get_staffing_roles(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<Vec<StaffingRole>>, AppError> {
    let roles = sqlx::query_as!(
        StaffingRole,
        r#"
        SELECT 
            id as "id!", 
            plan_id as "plan_id!", 
            role_name as "role_name!", 
            annual_salary as "annual_salary!", 
            start_month as "start_month!", 
            target_count as "target_count!", 
            hiring_plan as "hiring_plan!", 
            hiring_rate, 
            annual_increase_percent as "annual_increase_percent!", 
            created_at as "created_at!"
        FROM staffing_roles 
        WHERE plan_id = $1 
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        ORDER BY start_month ASC
        "#,
        plan_id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(roles))
}

pub async fn create_staffing_role(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateStaffingRoleRequest>,
) -> Result<Json<StaffingRole>, AppError> {
    // Length Validation
    if payload.role_name.len() > 255 {
        return Err(AppError::ValidationError("Role name exceeds 255 characters".to_string()));
    }
    if payload.hiring_plan.len() > 255 {
        return Err(AppError::ValidationError("Hiring plan exceeds 255 characters".to_string()));
    }

    // Parse Decimals
    let annual_salary = Decimal::from_str(&payload.annual_salary)
        .map_err(|_| AppError::ValidationError("Invalid format for annual_salary".to_string()))?;

    let annual_increase_percent = Decimal::from_str(&payload.annual_increase_percent)
        .map_err(|_| AppError::ValidationError("Invalid format for annual_increase_percent".to_string()))?;

    // Validate
    if annual_salary < Decimal::ZERO {
        return Err(AppError::ValidationError("Annual salary must be non-negative".to_string()));
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
        return Err(AppError::NotFound("Financial plan not found".into()));
    }

    // Normalize hiring_plan to lowercase
    let hiring_plan = payload.hiring_plan.to_lowercase();

    let role = sqlx::query_as!(
        StaffingRole,
        r#"
        INSERT INTO staffing_roles (plan_id, role_name, annual_salary, start_month, target_count, hiring_plan, hiring_rate, annual_increase_percent) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING 
            id as "id!", 
            plan_id as "plan_id!", 
            role_name as "role_name!", 
            annual_salary as "annual_salary!", 
            start_month as "start_month!", 
            target_count as "target_count!", 
            hiring_plan as "hiring_plan!", 
            hiring_rate, 
            annual_increase_percent as "annual_increase_percent!", 
            created_at as "created_at!"
        "#,
        payload.plan_id,
        payload.role_name,
        annual_salary,
        payload.start_month,
        payload.target_count,
        hiring_plan,
        payload.hiring_rate,
        annual_increase_percent
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(role))
}

pub async fn update_staffing_role(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateStaffingRoleRequest>,
) -> Result<Json<StaffingRole>, AppError> {
    // Length Validation
    if let Some(ref name) = payload.role_name {
        if name.len() > 255 {
            return Err(AppError::ValidationError("Role name exceeds 255 characters".to_string()));
        }
    }
    if let Some(ref plan) = payload.hiring_plan {
        if plan.len() > 255 {
            return Err(AppError::ValidationError("Hiring plan exceeds 255 characters".to_string()));
        }
    }

    // Parse Decimals
    let annual_salary = match &payload.annual_salary {
        Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for annual_salary".to_string()))?),
        None => None,
    };

    let annual_increase_percent = match &payload.annual_increase_percent {
        Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for annual_increase_percent".to_string()))?),
        None => None,
    };

    // Validate
    if let Some(val) = annual_salary {
        if val < Decimal::ZERO {
            return Err(AppError::ValidationError("Annual salary must be non-negative".to_string()));
        }
    }

    // Normalize hiring_plan to lowercase if present
    let hiring_plan = payload.hiring_plan.map(|s| s.to_lowercase());

    let role = sqlx::query_as!(
        StaffingRole,
        r#"
        UPDATE staffing_roles SET
            role_name = COALESCE($1, role_name),
            annual_salary = COALESCE($2, annual_salary),
            start_month = COALESCE($3, start_month),
            target_count = COALESCE($4, target_count),
            hiring_plan = COALESCE($5, hiring_plan),
            hiring_rate = COALESCE($6, hiring_rate),
            annual_increase_percent = COALESCE($7, annual_increase_percent)
        WHERE id = $8
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $9)
        RETURNING 
            id as "id!", 
            plan_id as "plan_id!", 
            role_name as "role_name!", 
            annual_salary as "annual_salary!", 
            start_month as "start_month!", 
            target_count as "target_count!", 
            hiring_plan as "hiring_plan!", 
            hiring_rate, 
            annual_increase_percent as "annual_increase_percent!", 
            created_at as "created_at!"
        "#,
        payload.role_name,
        annual_salary,
        payload.start_month,
        payload.target_count,
        hiring_plan,
        payload.hiring_rate,
        annual_increase_percent,
        id,
        claims.tenant_id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(role))
}

pub async fn delete_staffing_role(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    let result = sqlx::query!(
        "DELETE FROM staffing_roles 
         WHERE id = $1 
         AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)", 
        id,
        claims.tenant_id
    )
    .execute(&pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Staffing role not found".into()));
    }

    Ok(())
}
