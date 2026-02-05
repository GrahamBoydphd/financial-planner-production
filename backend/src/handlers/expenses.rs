use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use crate::models::{ExpenseItem, Claims};
use crate::errors::AppError;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use std::str::FromStr;

#[derive(Deserialize)]
pub struct CreateExpenseRequest {
    pub plan_id: Uuid,
    pub expense_name: String,
    pub category: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: String,
    pub growth_rate_percent: String,
    pub frequency: String,
    pub pct_of_revenue: Option<String>,
    pub volatility_type: Option<String>,
    pub vol_min: Option<String>,
    pub vol_max: Option<String>,
    pub vol_intervals: Option<i32>,
    pub target_mean: String,
    pub vol_scale: Option<String>,
    pub vol_freedom: Option<String>,
    pub vol_alpha: Option<String>,
    pub vol_beta: Option<String>,
    pub vol_input_mode: String,
    pub vol_fatness_level: Option<String>,
    pub vol_skew_level: Option<String>,
    pub vol_width_level: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateExpenseRequest {
    pub expense_name: String,
    pub category: String,
    pub start_month: i32,
    pub end_month: Option<i32>,
    pub initial_amount: String,
    pub growth_rate_percent: String,
    pub frequency: String,
    pub pct_of_revenue: Option<String>,
    pub volatility_type: Option<String>,
    pub vol_min: Option<String>,
    pub vol_max: Option<String>,
    pub vol_intervals: Option<i32>,
    pub target_mean: String,
    pub vol_scale: Option<String>,
    pub vol_freedom: Option<String>,
    pub vol_alpha: Option<String>,
    pub vol_beta: Option<String>,
    pub vol_input_mode: String,
    pub vol_fatness_level: Option<String>,
    pub vol_skew_level: Option<String>,
    pub vol_width_level: Option<String>,
}

// Helper to calculate NRIG parameters
fn calculate_nrig_params(
    mode: &str,
    fatness: Option<&str>,
    skew: Option<&str>,
    width: Option<&str>,
    target_mean: Decimal,
    inp_alpha: Option<Decimal>,
    inp_beta: Option<Decimal>,
    inp_scale: Option<Decimal>,
) -> Result<(Option<Decimal>, Option<Decimal>, Option<Decimal>, Decimal), AppError> {
    let target_mean_f = target_mean.to_f64().unwrap_or(0.0);

    if mode == "simple" {
        // 1. Alpha (Fatness)
        let alpha_f: f64 = match fatness.unwrap_or("heavy") {
            "skinny" => 100.0,
            "normal" => 50.0,
            "moderate" => 2.0,
            "heavy" | _ => 0.5,
        };

        // 2. Beta (Skew)
        let skew_factor: f64 = match skew.unwrap_or("symmetric") {
            "strong_downside" => -0.9,
            "medium_downside" => -0.4,
            "symmetric" => 0.0,
            "medium_upside" => 0.4,
            "strong_upside" => 0.9,
            _ => 0.0,
        };
        let beta_f: f64 = alpha_f * skew_factor;

        // 3. Scale/Delta (Width)
        let sigma: f64 = match width.unwrap_or("medium") {
            "very_low" => 1.0,
            "low" => 3.2,
            "medium" => 10.0,
            "high" => 32.0,
            _ => 10.0,
        };
        
        // Delta = Sigma^2 * Alpha * (1 - Factor^2)^1.5
        let term = (1.0 - skew_factor.powi(2)).powf(1.5);
        let delta_f = sigma.powi(2) * alpha_f * term;

        // 4. Mu
        // Mu = Target - Delta * (Beta / sqrt(Alpha^2 - Beta^2))
        let denom = (alpha_f.powi(2) - beta_f.powi(2)).sqrt();
        let drift = if denom > 0.0 {
            delta_f * (beta_f / denom)
        } else {
            0.0
        };
        let mu_f = target_mean_f - drift;

        Ok((
            Decimal::from_f64_retain(alpha_f),
            Decimal::from_f64_retain(beta_f),
            Decimal::from_f64_retain(delta_f),
            Decimal::from_f64_retain(mu_f).unwrap_or(target_mean),
        ))
    } else {
        // Advanced Mode
        let alpha = inp_alpha.ok_or_else(|| AppError::ValidationError("Alpha required for advanced NRIG".to_string()))?;
        let beta = inp_beta.ok_or_else(|| AppError::ValidationError("Beta required for advanced NRIG".to_string()))?;
        let scale = inp_scale.ok_or_else(|| AppError::ValidationError("Scale required for advanced NRIG".to_string()))?;

        let alpha_f = alpha.to_f64().unwrap_or(0.0);
        let beta_f = beta.to_f64().unwrap_or(0.0);
        let scale_f = scale.to_f64().unwrap_or(0.0);

        if alpha_f.abs() <= beta_f.abs() {
             return Err(AppError::ValidationError(format!(
                "NRIG Error: Alpha ({}) must be greater than absolute Beta ({})",
                alpha_f, beta_f.abs()
            )));
        }

        let denom = (alpha_f.powi(2) - beta_f.powi(2)).sqrt();
        let drift = if denom > 0.0 {
            scale_f * (beta_f / denom)
        } else {
            0.0
        };
        let mu_f = target_mean_f - drift;

        Ok((Some(alpha), Some(beta), Some(scale), Decimal::from_f64_retain(mu_f).unwrap_or(target_mean)))
    }
}

pub async fn create_expense_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateExpenseRequest>,
) -> Result<Json<ExpenseItem>, AppError> {
    // Length Validation
    if payload.expense_name.len() > 255 {
        return Err(AppError::ValidationError("Name exceeds 255 characters".to_string()));
    }
    if payload.category.len() > 255 {
        return Err(AppError::ValidationError("Category exceeds 255 characters".to_string()));
    }

    // Parse Decimals from Strings
    let initial_amount = Decimal::from_str(&payload.initial_amount)
        .map_err(|_| AppError::ValidationError("Invalid format for initial_amount".to_string()))?;
    
    let growth_rate_percent = Decimal::from_str(&payload.growth_rate_percent)
        .map_err(|_| AppError::ValidationError("Invalid format for growth_rate_percent".to_string()))?;

    let pct_of_revenue = match &payload.pct_of_revenue {
        Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for pct_of_revenue".to_string()))?),
        None => None,
    };

    let vol_min = match &payload.vol_min {
        Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_min".to_string()))?),
        None => None,
    };

    let vol_max = match &payload.vol_max {
        Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_max".to_string()))?),
        None => None,
    };

    let target_mean = Decimal::from_str(&payload.target_mean)
        .map_err(|_| AppError::ValidationError("Invalid format for target_mean".to_string()))?;

    let mut vol_scale = match &payload.vol_scale {
        Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_scale".to_string()))?),
        None => None,
    };

    let vol_freedom = match &payload.vol_freedom {
        Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_freedom".to_string()))?),
        None => None,
    };

    let mut vol_alpha = match &payload.vol_alpha {
        Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_alpha".to_string()))?),
        None => None,
    };

    let mut vol_beta = match &payload.vol_beta {
        Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_beta".to_string()))?),
        None => None,
    };

    // Verify plan ownership
    let plan_exists: Option<_> = sqlx::query!(
        "SELECT id FROM financial_plans WHERE id = $1 AND tenant_id = $2",
        payload.plan_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    if plan_exists.is_none() {
        return Err(AppError::NotFound("Financial plan not found or access denied".to_string()));
    }

    if initial_amount < Decimal::ZERO {
        return Err(AppError::ValidationError("Initial amount must be non-negative".to_string()));
    }

    // Calculate vol_mu based on distribution type
    let mut vol_mu = target_mean;

    if let Some(ref vt) = payload.volatility_type {
        let valid_vol_types = ["normal", "student_t", "nrig", "flat"];
        if !valid_vol_types.contains(&vt.as_str()) {
            return Err(AppError::ValidationError(format!(
                "Invalid volatility_type: '{}'. Must be one of: {:?}", 
                vt, valid_vol_types
            )));
        }

        if vt == "nrig" {
            let (a, b, s, m) = calculate_nrig_params(
                &payload.vol_input_mode,
                payload.vol_fatness_level.as_deref(),
                payload.vol_skew_level.as_deref(),
                payload.vol_width_level.as_deref(),
                target_mean,
                vol_alpha,
                vol_beta,
                vol_scale
            )?;
            vol_alpha = a;
            vol_beta = b;
            vol_scale = s;
            vol_mu = m;
        }
    }

    let item = sqlx::query_as!(
        ExpenseItem,
        r#"
        INSERT INTO expense_items (
            plan_id, expense_name, category, start_month, end_month, initial_amount, growth_rate_percent, frequency, pct_of_revenue,
            volatility_type, vol_min, vol_max, vol_intervals, vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta,
            target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        RETURNING 
            id as "id!", plan_id as "plan_id!", expense_name as "expense_name!", category as "category!", 
            start_month as "start_month!", end_month, 
            initial_amount as "initial_amount!", growth_rate_percent as "growth_rate_percent!", 
            frequency as "frequency!", pct_of_revenue, 
            volatility_type, vol_min, vol_max, vol_intervals, vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta, 
            target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level,
            created_at as "created_at!"
        "#,
        payload.plan_id, payload.expense_name, payload.category, payload.start_month, payload.end_month, 
        initial_amount, growth_rate_percent, payload.frequency, pct_of_revenue,
        payload.volatility_type, vol_min, vol_max, payload.vol_intervals,
        vol_mu, // Legacy vol_mean gets the calculated mu
        vol_scale, vol_freedom, vol_alpha, vol_beta,
        target_mean, vol_mu, payload.vol_input_mode, payload.vol_fatness_level, payload.vol_skew_level, payload.vol_width_level
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(item))
}

pub async fn get_expense_items(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<Vec<ExpenseItem>>, AppError> {
    let items = sqlx::query_as!(
        ExpenseItem,
        r#"
        SELECT 
            id as "id!", plan_id as "plan_id!", expense_name as "expense_name!", category as "category!", 
            start_month as "start_month!", end_month, 
            initial_amount as "initial_amount!", growth_rate_percent as "growth_rate_percent!", 
            frequency as "frequency!", pct_of_revenue, 
            volatility_type, vol_min, vol_max, vol_intervals, vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta, 
            target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level,
            created_at as "created_at!"
        FROM expense_items 
        WHERE plan_id = $1 
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)
        ORDER BY start_month ASC
        "#,
        plan_id,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(items))
}

pub async fn update_expense_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateExpenseRequest>,
) -> Result<Json<ExpenseItem>, AppError> {
    // Length Validation
    if payload.expense_name.len() > 255 {
        return Err(AppError::ValidationError("Name exceeds 255 characters".to_string()));
    }
    if payload.category.len() > 255 {
        return Err(AppError::ValidationError("Category exceeds 255 characters".to_string()));
    }

    // Parse Decimals from Strings
    let initial_amount = Decimal::from_str(&payload.initial_amount)
        .map_err(|_| AppError::ValidationError("Invalid format for initial_amount".to_string()))?;
    
    let growth_rate_percent = Decimal::from_str(&payload.growth_rate_percent)
        .map_err(|_| AppError::ValidationError("Invalid format for growth_rate_percent".to_string()))?;

    let pct_of_revenue = match &payload.pct_of_revenue {
        Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for pct_of_revenue".to_string()))?),
        None => None,
    };

    let vol_min = match &payload.vol_min {
        Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_min".to_string()))?),
        None => None,
    };

    let vol_max = match &payload.vol_max {
        Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_max".to_string()))?),
        None => None,
    };

    let target_mean = Decimal::from_str(&payload.target_mean)
        .map_err(|_| AppError::ValidationError("Invalid format for target_mean".to_string()))?;

    let mut vol_scale = match &payload.vol_scale {
        Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_scale".to_string()))?),
        None => None,
    };

    let vol_freedom = match &payload.vol_freedom {
        Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_freedom".to_string()))?),
        None => None,
    };

    let mut vol_alpha = match &payload.vol_alpha {
        Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_alpha".to_string()))?),
        None => None,
    };

    let mut vol_beta = match &payload.vol_beta {
        Some(v) => Some(Decimal::from_str(v).map_err(|_| AppError::ValidationError("Invalid format for vol_beta".to_string()))?),
        None => None,
    };

    if initial_amount < Decimal::ZERO {
        return Err(AppError::ValidationError("Initial amount must be non-negative".to_string()));
    }

    // Calculate vol_mu based on distribution type
    let mut vol_mu = target_mean;

    if let Some(ref vt) = payload.volatility_type {
        let valid_vol_types = ["normal", "student_t", "nrig", "flat"];
        if !valid_vol_types.contains(&vt.as_str()) {
            return Err(AppError::ValidationError(format!(
                "Invalid volatility_type: '{}'. Must be one of: {:?}", 
                vt, valid_vol_types
            )));
        }

        if vt == "nrig" {
            let (a, b, s, m) = calculate_nrig_params(
                &payload.vol_input_mode,
                payload.vol_fatness_level.as_deref(),
                payload.vol_skew_level.as_deref(),
                payload.vol_width_level.as_deref(),
                target_mean,
                vol_alpha,
                vol_beta,
                vol_scale
            )?;
            vol_alpha = a;
            vol_beta = b;
            vol_scale = s;
            vol_mu = m;
        }
    }

    let item = sqlx::query_as!(
        ExpenseItem,
        r#"
        UPDATE expense_items SET
            expense_name = $1, category = $2, start_month = $3, end_month = $4,
            initial_amount = $5, growth_rate_percent = $6, frequency = $7, pct_of_revenue = $8,
            volatility_type = $9, vol_min = $10, vol_max = $11, vol_intervals = $12,
            vol_mean = $13, vol_scale = $14, vol_freedom = $15, vol_alpha = $16, vol_beta = $17,
            target_mean = $18, vol_mu = $19, vol_input_mode = $20, vol_fatness_level = $21, vol_skew_level = $22, vol_width_level = $23
        WHERE id = $24
        AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $25)
        RETURNING 
            id as "id!", plan_id as "plan_id!", expense_name as "expense_name!", category as "category!", 
            start_month as "start_month!", end_month, 
            initial_amount as "initial_amount!", growth_rate_percent as "growth_rate_percent!", 
            frequency as "frequency!", pct_of_revenue, 
            volatility_type, vol_min, vol_max, vol_intervals, vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta, 
            target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level,
            created_at as "created_at!"
        "#,
        payload.expense_name, payload.category, payload.start_month, payload.end_month, 
        initial_amount, growth_rate_percent, payload.frequency, pct_of_revenue,
        payload.volatility_type, vol_min, vol_max, payload.vol_intervals,
        vol_mu, // Legacy vol_mean gets the calculated mu
        vol_scale, vol_freedom, vol_alpha, vol_beta,
        target_mean, vol_mu, payload.vol_input_mode, payload.vol_fatness_level, payload.vol_skew_level, payload.vol_width_level,
        id,
        claims.tenant_id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(item))
}

pub async fn delete_expense_item(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result: sqlx::postgres::PgQueryResult = sqlx::query!(
        "DELETE FROM expense_items WHERE id = $1 AND plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2)",
        id,
        claims.tenant_id
    )
    .execute(&pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Item not found or access denied".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
