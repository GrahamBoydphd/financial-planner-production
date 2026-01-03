use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;
use sqlx::{Pool, Postgres};
use rust_decimal::Decimal;
use crate::models::StaffingRole;
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct CreateStaffingRoleRequest {
    pub plan_id: Uuid,
    pub role_name: String,
    pub annual_salary: Decimal,
    pub start_month: i32,
    pub target_count: i32, // Renamed from count
    pub hiring_plan: String, // New field
    pub hiring_rate: Option<i32>, // New field
    pub annual_increase: Decimal,
}

#[derive(Deserialize)]
pub struct UpdateStaffingRoleRequest {
    pub role_name: Option<String>,
    pub annual_salary: Option<Decimal>,
    pub start_month: Option<i32>,
    pub target_count: Option<i32>, // Renamed from count
    pub hiring_plan: Option<String>, // New field
    pub hiring_rate: Option<i32>, // New field
    pub annual_increase: Option<Decimal>,
}

pub async fn get_staffing_roles(
    State(pool): State<Pool<Postgres>>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<Vec<StaffingRole>>, AppError> {
    let roles = sqlx::query_as!(
        StaffingRole,
        "SELECT id, plan_id, role_name, annual_salary, start_month, target_count, hiring_plan, hiring_rate, annual_increase, created_at 
         FROM staffing_roles 
         WHERE plan_id = $1 
         ORDER BY start_month ASC",
        plan_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(roles))
}

pub async fn create_staffing_role(
    State(pool): State<Pool<Postgres>>,
    Json(payload): Json<CreateStaffingRoleRequest>,
) -> Result<Json<StaffingRole>, AppError> {
    // Removed created_at from INSERT columns and VALUES.
    // The database will handle the default timestamp.
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
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateStaffingRoleRequest>,
) -> Result<Json<StaffingRole>, AppError> {
    // Added created_at to the RETURNING clause so the StaffingRole struct can be fully populated.
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
         RETURNING id, plan_id, role_name, annual_salary, start_month, target_count, hiring_plan, hiring_rate, annual_increase, created_at",
        payload.role_name,
        payload.annual_salary,
        payload.start_month,
        payload.target_count,
        payload.hiring_plan,
        payload.hiring_rate,
        payload.annual_increase,
        id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(role))
}

pub async fn delete_staffing_role(
    State(pool): State<Pool<Postgres>>,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    sqlx::query!("DELETE FROM staffing_roles WHERE id = $1", id)
        .execute(&pool)
        .await?;
    Ok(())
}
