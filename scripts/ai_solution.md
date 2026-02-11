🤖 Connecting to gemini-3-pro-preview (Paid Tier)...
<file path='backend/src/handlers/lifecycle.rs'>
use axum::{
    extract::{Path, State},
    Json, Extension,
};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;
use chrono::Utc;
use crate::models::{
    Fund, Company, FinancialPlan, RevenueItem, ExpenseItem, 
    CapitalInjection, DividendPolicy, CreditFacility, 
    ValuationAssumption, Event, CapitalGrowthPolicy, StaffingRole,
    Claims
};
use crate::errors::AppError;

// --- Internal Helpers ---

async fn copy_plan_internal(
    txn: &mut Transaction<'_, Postgres>,
    source_plan_id: Uuid,
    target_company_id: Uuid,
    tenant_id: Uuid,
    name_suffix: Option<String>,
) -> Result<Uuid, AppError> {
    let source_plan = sqlx::query_as!(
        FinancialPlan,
        "SELECT * FROM financial_plans WHERE id = $1",
        source_plan_id
    )
    .fetch_one(&mut **txn)
    .await?;

    let new_plan_id = Uuid::new_v4();
    let suffix = name_suffix.as_deref().unwrap_or(" (Copy)");
    let new_name = format!("{}{}", source_plan.plan_name, suffix);

    sqlx::query!(
        r#"
        INSERT INTO financial_plans (
            id, company_id, plan_name, start_month, currency_code, 
            created_at, updated_at, initial_cash, pooling_fraction, tenant_id, insolvency_threshold,
            soft_limit_active, soft_limit_threshold, soft_limit_fraction
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6, $7, $8, $9, $10, $11, $12)
        "#,
        new_plan_id,
        target_company_id,
        new_name,
        source_plan.start_month,
        source_plan.currency_code,
        source_plan.initial_cash,
        source_plan.pooling_fraction,
        tenant_id,
        source_plan.insolvency_threshold,
        source_plan.soft_limit_active,
        source_plan.soft_limit_threshold,
        source_plan.soft_limit_fraction
    )
    .execute(&mut **txn)
    .await?;

    // Copy Revenue
    let revenues = sqlx::query_as!(RevenueItem, "SELECT * FROM revenue_items WHERE plan_id = $1", source_plan_id)
        .fetch_all(&mut **txn).await?;
    for item in revenues {
        sqlx::query!(
            r#"INSERT INTO revenue_items (
                id, plan_id, revenue_name, source, start_month, end_month, 
                initial_amount, growth_rate_percent, frequency, cost_of_revenue_percent,
                volatility_type, vol_min, vol_max, vol_intervals, vol_mean, vol_scale,
                vol_freedom, vol_alpha, vol_beta, created_at,
                target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)"#,
            Uuid::new_v4(), new_plan_id, item.revenue_name, item.source, item.start_month, item.end_month,
            item.initial_amount, item.growth_rate_percent, item.frequency, item.cost_of_revenue_percent,
            item.volatility_type, item.vol_min, item.vol_max, item.vol_intervals, item.vol_mean, item.vol_scale,
            item.vol_freedom, item.vol_alpha, item.vol_beta, Utc::now(),
            item.target_mean, item.vol_mu, item.vol_input_mode, item.vol_fatness_level, item.vol_skew_level, item.vol_width_level
        ).execute(&mut **txn).await?;
    }

    // Copy Expenses
    let expenses = sqlx::query_as!(ExpenseItem, "SELECT * FROM expense_items WHERE plan_id = $1", source_plan_id)
        .fetch_all(&mut **txn).await?;
    for item in expenses {
        sqlx::query!(
            r#"INSERT INTO expense_items (
                id, plan_id, expense_name, category, start_month, end_month,
                initial_amount, growth_rate_percent, frequency, pct_of_revenue,
                volatility_type, vol_min, vol_max, vol_intervals, vol_mean, vol_scale,
                vol_freedom, vol_alpha, vol_beta, created_at,
                target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)"#,
            Uuid::new_v4(), new_plan_id, item.expense_name, item.category, item.start_month, item.end_month,
            item.initial_amount, item.growth_rate_percent, item.frequency, item.pct_of_revenue,
            item.volatility_type, item.vol_min, item.vol_max, item.vol_intervals, item.vol_mean, item.vol_scale,
            item.vol_freedom, item.vol_alpha, item.vol_beta, Utc::now(),
            item.target_mean, item.vol_mu, item.vol_input_mode, item.vol_fatness_level, item.vol_skew_level, item.vol_width_level
        ).execute(&mut **txn).await?;
    }

    // Copy Staffing
    let staffing = sqlx::query_as!(StaffingRole, "SELECT * FROM staffing_roles WHERE plan_id = $1", source_plan_id)
        .fetch_all(&mut **txn).await?;
    for item in staffing {
        sqlx::query!(
            r#"INSERT INTO staffing_roles (
                id, plan_id, role_name, annual_salary, start_month, target_count,
                hiring_plan, hiring_rate, annual_increase_percent, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"#,
            Uuid::new_v4(), new_plan_id, item.role_name, item.annual_salary, item.start_month, item.target_count,
            item.hiring_plan, item.hiring_rate, item.annual_increase_percent, Utc::now()
        ).execute(&mut **txn).await?;
    }

    // Copy Capital Injections
    let injections = sqlx::query_as!(CapitalInjection, "SELECT * FROM capital_injections WHERE plan_id = $1", source_plan_id)
        .fetch_all(&mut **txn).await?;
    for item in injections {
        sqlx::query!(
            r#"INSERT INTO capital_injections (
                id, plan_id, injection_name, amount, month, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6)"#,
            Uuid::new_v4(), new_plan_id, item.injection_name, item.amount, item.month, Utc::now()
        ).execute(&mut **txn).await?;
    }

    // Copy Events
    let events = sqlx::query_as!(
        Event,
        r#"
        SELECT 
            id as "id!", 
            plan_id, 
            fund_ids, 
            company_ids, 
            event_name as "event_name!", 
            start_month, 
            event_category, 
            impact_type, 
            impact_value, 
            duration_months, 
            likelihood_annual_pct, 
            magnitude, 
            direction, 
            duration_category, 
            is_counter_cyclic, 
            created_at as "created_at!"
        FROM events 
        WHERE plan_id = $1
        "#,
        source_plan_id
    )
    .fetch_all(&mut **txn)
    .await?;
    
    for item in events {
        // Ensure the event is strictly linked to the target company.
        // This prevents copied events from pointing to the old company or being null.
        let new_company_ids = vec![target_company_id];

        sqlx::query!(
            r#"INSERT INTO events (
                id, plan_id, fund_ids, company_ids, event_name, start_month, 
                event_category, impact_type, impact_value, duration_months, 
                likelihood_annual_pct, magnitude, direction, duration_category, 
                is_counter_cyclic, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)"#,
            Uuid::new_v4(), new_plan_id, 
            item.fund_ids.as_deref(), 
            &new_company_ids, 
            item.event_name, item.start_month,
            item.event_category, item.impact_type, item.impact_value, item.duration_months,
            item.likelihood_annual_pct, item.magnitude, item.direction, item.duration_category, 
            item.is_counter_cyclic, Utc::now()
        ).execute(&mut **txn).await?;
    }

    // Copy Dividend Policy
    let dividends = sqlx::query_as!(DividendPolicy, 
        r#"SELECT id, plan_id, is_enabled, safety_threshold, payout_ratio, created_at, tracking_enabled as "tracking_enabled!" 
           FROM dividend_policies WHERE plan_id = $1"#, 
        source_plan_id)
        .fetch_optional(&mut **txn).await?;
    if let Some(item) = dividends {
        sqlx::query!(
            r#"INSERT INTO dividend_policies (
                id, plan_id, is_enabled, safety_threshold, payout_ratio, created_at, tracking_enabled
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)"#,
            Uuid::new_v4(), new_plan_id, item.is_enabled, item.safety_threshold, item.payout_ratio, Utc::now(), item.tracking_enabled
        ).execute(&mut **txn).await?;
    }

    // Copy Credit Facility
    let credit = sqlx::query_as!(CreditFacility, "SELECT * FROM credit_facilities WHERE plan_id = $1", source_plan_id)
        .fetch_optional(&mut **txn).await?;
    if let Some(item) = credit {
        sqlx::query!(
            r#"INSERT INTO credit_facilities (
                id, plan_id, facility_limit, interest_rate, is_annual_rate, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6)"#,
            Uuid::new_v4(), new_plan_id, item.facility_limit, item.interest_rate, item.is_annual_rate, Utc::now()
        ).execute(&mut **txn).await?;
    }

    // Copy Valuation Assumption
    let valuation = sqlx::query_as!(ValuationAssumption, "SELECT * FROM valuation_assumptions WHERE plan_id = $1", source_plan_id)
        .fetch_optional(&mut **txn).await?;
    if let Some(item) = valuation {
        sqlx::query!(
            r#"INSERT INTO valuation_assumptions (
                id, plan_id, valuation_name, method, multiplier, date_applied, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)"#,
            Uuid::new_v4(), new_plan_id, item.valuation_name, item.method, item.multiplier, item.date_applied, Utc::now()
        ).execute(&mut **txn).await?;
    }

    // Copy Capital Growth Policy
    let growth = sqlx::query_as!(CapitalGrowthPolicy, "SELECT * FROM capital_growth_policies WHERE plan_id = $1", source_plan_id)
        .fetch_optional(&mut **txn).await?;
    if let Some(item) = growth {
        sqlx::query!(
            r#"INSERT INTO capital_growth_policies (
                id, plan_id, volatility_type, vol_min, vol_max, vol_intervals, vol_mean, vol_scale,
                vol_freedom, vol_alpha, vol_beta, created_at, growth_rate_percent,
                target_mean, vol_mu, vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)"#,
            Uuid::new_v4(), new_plan_id, item.volatility_type, item.vol_min, item.vol_max, item.vol_intervals, item.vol_mean, item.vol_scale,
            item.vol_freedom, item.vol_alpha, item.vol_beta, Utc::now(), item.growth_rate_percent,
            item.target_mean, item.vol_mu, item.vol_input_mode, item.vol_fatness_level, item.vol_skew_level, item.vol_width_level
        ).execute(&mut **txn).await?;
    }

    Ok(new_plan_id)
}

async fn copy_company_internal(
    txn: &mut Transaction<'_, Postgres>,
    source_company_id: Uuid,
    target_fund_id: Uuid,
    tenant_id: Uuid,
    name_suffix: Option<String>,
) -> Result<Uuid, AppError> {
    let source_company = sqlx::query_as!(
        Company,
        "SELECT * FROM companies WHERE id = $1",
        source_company_id
    )
    .fetch_one(&mut **txn)
    .await?;

    let new_company_id = Uuid::new_v4();
    let suffix = name_suffix.as_deref().unwrap_or(" (Copy)");
    let new_name = format!("{}{}", source_company.company_name, suffix);

    sqlx::query!(
        r#"
        INSERT INTO companies (
            id, fund_id, company_name, currency_code, created_at,
            industry, business_model, technology, tenant_id
        )
        VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8)
        "#,
        new_company_id,
        target_fund_id,
        new_name,
        source_company.currency_code,
        source_company.industry,
        source_company.business_model,
        source_company.technology,
        tenant_id
    )
    .execute(&mut **txn)
    .await?;

    let plans = sqlx::query!(
        "SELECT id FROM financial_plans WHERE company_id = $1",
        source_company_id
    )
    .fetch_all(&mut **txn)
    .await?;

    for plan_row in plans {
        copy_plan_internal(txn, plan_row.id, new_company_id, tenant_id, name_suffix.clone()).await?;
    }

    // Copy Company-Level Events
    // We copy events where this company is targeted (in company_ids) and plan_id is NULL.
    // We re-link them to the new company. fund_ids MUST be NULL so they are not treated as Global/Fund events.
    sqlx::query!(
        r#"
        INSERT INTO events (
            id, plan_id, fund_ids, company_ids, event_name, start_month, 
            event_category, impact_type, impact_value, duration_months, 
            likelihood_annual_pct, magnitude, direction, duration_category, 
            is_counter_cyclic, created_at
        )
        SELECT 
            gen_random_uuid(), 
            NULL, 
            CAST(NULL AS UUID[]), 
            ARRAY[$2]::uuid[], 
            event_name, start_month, 
            event_category, impact_type, impact_value, duration_months, 
            likelihood_annual_pct, magnitude, direction, duration_category, 
            is_counter_cyclic, NOW()
        FROM events
        WHERE $1 = ANY(company_ids) AND plan_id IS NULL
        "#,
        source_company_id,
        new_company_id
    )
    .execute(&mut **txn)
    .await?;

    Ok(new_company_id)
}

// --- Handlers ---

pub async fn duplicate_plan_handler(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<FinancialPlan>, AppError> {
    let mut txn = pool.begin().await?;

    let source_plan = sqlx::query!(
        "SELECT company_id FROM financial_plans WHERE id = $1 AND tenant_id = $2",
        plan_id,
        claims.tenant_id
    )
    .fetch_optional(&mut *txn)
    .await?;

    let source_plan = match source_plan {
        Some(p) => p,
        None => return Err(AppError::NotFound("Plan not found".to_string())),
    };

    let new_id = copy_plan_internal(&mut txn, plan_id, source_plan.company_id, claims.tenant_id, None).await?;

    txn.commit().await?;

    let new_plan = sqlx::query_as!(
        FinancialPlan,
        "SELECT * FROM financial_plans WHERE id = $1",
        new_id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(new_plan))
}

pub async fn duplicate_company_handler(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(company_id): Path<Uuid>,
) -> Result<Json<Company>, AppError> {
    let mut txn = pool.begin().await?;

    let source_company = sqlx::query!(
        "SELECT fund_id FROM companies WHERE id = $1 AND tenant_id = $2",
        company_id,
        claims.tenant_id
    )
    .fetch_optional(&mut *txn)
    .await?;

    let source_company = match source_company {
        Some(c) => c,
        None => return Err(AppError::NotFound("Company not found".to_string())),
    };

    let new_id = copy_company_internal(&mut txn, company_id, source_company.fund_id, claims.tenant_id, None).await?;

    txn.commit().await?;

    let new_company = sqlx::query_as!(
        Company,
        "SELECT * FROM companies WHERE id = $1",
        new_id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(new_company))
}

pub async fn duplicate_fund_handler(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(fund_id): Path<Uuid>,
) -> Result<Json<Fund>, AppError> {
    let mut txn = pool.begin().await?;

    let source_fund = sqlx::query_as!(
        Fund,
        "SELECT * FROM funds WHERE id = $1 AND tenant_id = $2",
        fund_id,
        claims.tenant_id
    )
    .fetch_optional(&mut *txn)
    .await?;

    let source_fund = match source_fund {
        Some(f) => f,
        None => return Err(AppError::NotFound("Fund not found".to_string())),
    };

    let new_fund_id = Uuid::new_v4();
    let new_name = format!("{} (Copy)", source_fund.fund_name);

    sqlx::query!(
        r#"
        INSERT INTO funds (id, user_id, fund_name, currency_code, created_at, tenant_id, is_public_template)
        VALUES ($1, $2, $3, $4, NOW(), $5, $6)
        "#,
        new_fund_id,
        claims.user_id,
        new_name,
        source_fund.currency_code,
        claims.tenant_id,
        false
    )
    .execute(&mut *txn)
    .await?;

    let companies = sqlx::query!(
        "SELECT id FROM companies WHERE fund_id = $1",
        fund_id
    )
    .fetch_all(&mut *txn)
    .await?;

    let child_suffix = format!(" (copy in {})", new_name);

    for comp in companies {
        copy_company_internal(&mut txn, comp.id, new_fund_id, claims.tenant_id, Some(child_suffix.clone())).await?;
    }

    // Copy Fund-Level Events
    // Events where this fund is targeted, but no specific company or plan.
    sqlx::query!(
        r#"
        INSERT INTO events (
            id, plan_id, fund_ids, company_ids, event_name, start_month, 
            event_category, impact_type, impact_value, duration_months, 
            likelihood_annual_pct, magnitude, direction, duration_category, 
            is_counter_cyclic, created_at
        )
        SELECT 
            gen_random_uuid(), 
            NULL, 
            ARRAY[$2]::uuid[], 
            NULL, 
            event_name, start_month, 
            event_category, impact_type, impact_value, duration_months, 
            likelihood_annual_pct, magnitude, direction, duration_category, 
            is_counter_cyclic, NOW()
        FROM events
        WHERE $1 = ANY(fund_ids) AND company_ids IS NULL AND plan_id IS NULL
        "#,
        fund_id,
        new_fund_id
    )
    .execute(&mut *txn)
    .await?;

    txn.commit().await?;

    let new_fund = sqlx::query_as!(
        Fund,
        "SELECT * FROM funds WHERE id = $1",
        new_fund_id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(new_fund))
}

#[derive(serde::Deserialize)]
pub struct MoveCompanyRequest {
    pub target_fund_id: Uuid,
}

pub async fn move_company_handler(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(company_id): Path<Uuid>,
    Json(payload): Json<MoveCompanyRequest>,
) -> Result<Json<Company>, AppError> {
    let target_exists = sqlx::query!(
        "SELECT id FROM funds WHERE id = $1 AND tenant_id = $2",
        payload.target_fund_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    if target_exists.is_none() {
        return Err(AppError::NotFound("Target fund not found".to_string()));
    }

    let updated = sqlx::query_as!(
        Company,
        "UPDATE companies SET fund_id = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *",
        payload.target_fund_id,
        company_id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?;

    match updated {
        Some(c) => Ok(Json(c)),
        None => Err(AppError::NotFound("Company not found".to_string())),
    }
}

pub async fn get_public_templates(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Fund>>, AppError> {
    let templates = sqlx::query_as!(
        Fund,
        "SELECT * FROM funds WHERE is_public_template = true"
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(templates))
}

pub async fn clone_template_handler(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(template_id): Path<Uuid>,
) -> Result<Json<Fund>, AppError> {
    let mut txn = pool.begin().await?;

    let template = sqlx::query_as!(
        Fund,
        "SELECT * FROM funds WHERE id = $1 AND is_public_template = true",
        template_id
    )
    .fetch_optional(&mut *txn)
    .await?;

    let template = match template {
        Some(t) => t,
        None => return Err(AppError::NotFound("Template not found".to_string())),
    };

    let new_fund_id = Uuid::new_v4();
    let new_name = format!("{} (Copy)", template.fund_name);

    sqlx::query!(
        r#"
        INSERT INTO funds (id, user_id, fund_name, currency_code, created_at, tenant_id, is_public_template)
        VALUES ($1, $2, $3, $4, NOW(), $5, $6)
        "#,
        new_fund_id,
        claims.user_id,
        new_name,
        template.currency_code,
        claims.tenant_id,
        false
    )
    .execute(&mut *txn)
    .await?;

    let companies = sqlx::query!(
        "SELECT id FROM companies WHERE fund_id = $1",
        template_id
    )
    .fetch_all(&mut *txn)
    .await?;

    for comp in companies {
        copy_company_internal(&mut txn, comp.id, new_fund_id, claims.tenant_id, Some("".to_string())).await?;
    }

    // Copy Fund-Level Events (Template Events)
    sqlx::query!(
        r#"
        INSERT INTO events (
            id, plan_id, fund_ids, company_ids, event_name, start_month, 
            event_category, impact_type, impact_value, duration_months, 
            likelihood_annual_pct, magnitude, direction, duration_category, 
            is_counter_cyclic, created_at
        )
        SELECT 
            gen_random_uuid(), 
            NULL, 
            ARRAY[$2]::uuid[], 
            NULL, 
            event_name, start_month, 
            event_category, impact_type, impact_value, duration_months, 
            likelihood_annual_pct, magnitude, direction, duration_category, 
            is_counter_cyclic, NOW()
        FROM events
        WHERE $1 = ANY(fund_ids) AND company_ids IS NULL AND plan_id IS NULL
        "#,
        template_id,
        new_fund_id
    )
    .execute(&mut *txn)
    .await?;

    txn.commit().await?;

    let new_fund = sqlx::query_as!(
        Fund,
        "SELECT * FROM funds WHERE id = $1",
        new_fund_id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(new_fund))
}
</file>

