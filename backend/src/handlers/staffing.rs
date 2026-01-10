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

#[derive(Deserialize)]
pub struct CreateStaffingRoleRequest {
    pub plan_id: Uuid,
    pub role_name: String,
    pub annual_salary: Decimal,
    pub start_month: i32,
    pub target_count: i32,
    pub hiring_plan: String,
    pub hiring_rate: Option<i32>,
    pub annual_increase: Decimal,
}

#[derive(Deserialize)]
pub struct UpdateStaffingRoleRequest {
    pub role_name: Option<String>,
    pub annual_salary: Option<Decimal>,
    pub start_month: Option<i32>,
    pub target_count: Option<i32>,
    pub hiring_plan: Option<String>,
    pub hiring_rate: Option<i32>,
    pub annual_increase: Option<Decimal>,
}

pub async fn get_staffing_roles(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<Vec<StaffingRole>>, AppError> {
    let roles = sqlx::query_as!(
        StaffingRole,
        "SELECT id, plan_id, role_name, annual_salary, start_month, target_count, hiring_plan, hiring_rate, annual_increase, created_at 
         FROM staffing_roles 
         WHERE plan_id = $1 
         AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
         ORDER BY start_month ASC",
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

    let role = sqlx::query_as!(
        StaffingRole,
        "INSERT INTO staffing_roles (plan_id, role_name, annual_salary, start_month, target_count, hiring_plan, hiring_rate, annual_increase) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id, plan_id, role_name, annual_salary, start_month, target_count, hiring_plan, hiring_rate, annual_increase, created_at",
        payload.plan_id,
        payload.role_name,
        payload.annual_salary,
        payload.start_month,
        payload.target_count,
        payload.hiring_plan,
        payload.hiring_rate,
        payload.annual_increase
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
    let role = sqlx::query_as!(
        StaffingRole,
        "UPDATE staffing_roles SET
            role_name = COALESCE($1, role_name),
            annual_salary = COALESCE($2, annual_salary),
            start_month = COALESCE($3, start_month),
            target_count = COALESCE($4, target_count),
            hiring_plan = COALESCE($5, hiring_plan),
            hiring_rate = COALESCE($6, hiring_rate),
            annual_increase = COALESCE($7, annual_increase)
         WHERE id = $8
         AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $9)
         RETURNING id, plan_id, role_name, annual_salary, start_month, target_count, hiring_plan, hiring_rate, annual_increase, created_at",
        payload.role_name,
        payload.annual_salary,
        payload.start_month,
        payload.target_count,
        payload.hiring_plan,
        payload.hiring_rate,
        payload.annual_increase,
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
