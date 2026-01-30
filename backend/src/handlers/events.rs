use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    Json,
    Extension,
};
use serde::Deserialize;
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use rust_decimal::Decimal;
use std::str::FromStr;
use crate::models::{Event, CreateEventRequest, Claims, EventPayload};
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct GetEventsQuery {
    pub target_ids: Option<String>,
}

/// Helper to validate scope and resolve target IDs.
/// Returns (fund_ids, company_ids, plan_id) if valid.
async fn resolve_targets(
    pool: &Pool<Postgres>,
    tenant_id: Uuid,
    scope: &str,
    target_ids: &[Uuid],
) -> Result<(Option<Vec<Uuid>>, Option<Vec<Uuid>>, Option<Uuid>), AppError> {
    if target_ids.is_empty() {
        return Err(AppError::ValidationError("At least one target ID is required".to_string()));
    }

    match scope {
        "global" => {
            // Validate all funds exist and belong to tenant
            let count = sqlx::query!(
                "SELECT count(*) as count FROM funds WHERE id = ANY($1) AND tenant_id = $2", 
                target_ids, 
                tenant_id
            )
            .fetch_one(pool)
            .await?
            .count.unwrap_or(0);
            
            if count != target_ids.len() as i64 { 
                return Err(AppError::NotFound("One or more funds not found".to_string())); 
            }
            Ok((Some(target_ids.to_vec()), None, None))
        },
        "local" => {
            // Validate all companies exist and belong to tenant
            let count = sqlx::query!(
                "SELECT count(*) as count FROM companies WHERE id = ANY($1) AND tenant_id = $2", 
                target_ids, 
                tenant_id
            )
            .fetch_one(pool)
            .await?
            .count.unwrap_or(0);
            
            if count != target_ids.len() as i64 { 
                return Err(AppError::NotFound("One or more companies not found".to_string())); 
            }
            Ok((None, Some(target_ids.to_vec()), None))
        },
        "plan" => {
            // Plan scope implies single target for now
            if target_ids.len() != 1 {
                return Err(AppError::ValidationError("Plan scope requires exactly one target ID".to_string()));
            }
            let target_id = target_ids[0];

            // Check plan
            let exists = sqlx::query!(
                "SELECT id FROM financial_plans WHERE id = $1 AND tenant_id = $2", 
                target_id, 
                tenant_id
            )
            .fetch_optional(pool)
            .await?;
            
            if exists.is_none() { 
                return Err(AppError::NotFound("Plan not found".to_string())); 
            }
            Ok((None, None, Some(target_id)))
        },
        _ => Err(AppError::ValidationError("Invalid scope. Must be 'global', 'local', or 'plan'".to_string())),
    }
}

pub async fn create_event(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateEventRequest>,
) -> Result<Json<Event>, AppError> {
    
    // 1. Determine Scope and Validate Target
    let (fund_ids, company_ids, plan_id) = resolve_targets(
        &pool, 
        claims.tenant_id, 
        &payload.scope, 
        &payload.target_ids
    ).await?;

    // 2. Map Semantic Fields
    let impact_type = if payload.event_type.to_lowercase().contains("revenue") {
        "revenue".to_string()
    } else if payload.event_type.to_lowercase().contains("expense") {
        "expense".to_string()
    } else {
        "cash".to_string()
    };

    let event_category = Some(payload.event_type.clone());
    
    // 3. Extract Data based on Payload Type
    let (
        start_month, 
        impact_value, 
        duration_months, 
        likelihood_annual_pct, 
        magnitude, 
        direction, 
        duration_category,
        is_counter_cyclic
    ) = match payload.data {
        EventPayload::Fixed { start_month, impact_value, duration_months } => {
            let val = Decimal::from_str(&impact_value)
                .map_err(|_| AppError::ValidationError("Invalid impact value format".to_string()))?;
            (
                Some(start_month),
                Some(val),
                duration_months,
                None,
                None,
                None,
                None,
                None
            )
        },
        EventPayload::Stochastic { occurrence_probability, magnitude, direction, duration, is_counter_cyclic } => {
            let prob = Decimal::from_str(&occurrence_probability)
                .map_err(|_| AppError::ValidationError("Invalid probability format".to_string()))?;
            (
                None,
                None,
                None,
                Some(prob),
                Some(magnitude),
                Some(direction),
                Some(duration),
                is_counter_cyclic
            )
        }
    };

    // 4. Insert Event
    let new_event = sqlx::query_as!(
        Event,
        r#"
        INSERT INTO events (
            plan_id, fund_ids, company_ids, 
            event_name, start_month, 
            event_category, impact_type, impact_value, 
            duration_months, likelihood_annual_pct,
            magnitude, direction, duration_category,
            is_counter_cyclic
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
        RETURNING 
            id as "id!", plan_id, fund_ids, company_ids,
            event_name as "event_name!", start_month, 
            event_category, impact_type, 
            impact_value, duration_months, 
            likelihood_annual_pct, magnitude, direction, duration_category,
            is_counter_cyclic,
            created_at as "created_at!"
        "#,
        plan_id,
        fund_ids.as_deref(),
        company_ids.as_deref(),
        payload.event_name,
        start_month,
        event_category,
        impact_type,
        impact_value,
        duration_months,
        likelihood_annual_pct,
        magnitude,
        direction,
        duration_category,
        is_counter_cyclic
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(new_event))
}

pub async fn update_event(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateEventRequest>,
) -> Result<Json<Event>, AppError> {
    
    // 1. Determine Scope and Validate Target (for the new values)
    let (fund_ids, company_ids, plan_id) = resolve_targets(
        &pool, 
        claims.tenant_id, 
        &payload.scope, 
        &payload.target_ids
    ).await?;

    // 2. Map Semantic Fields
    let impact_type = if payload.event_type.to_lowercase().contains("revenue") {
        "revenue".to_string()
    } else if payload.event_type.to_lowercase().contains("expense") {
        "expense".to_string()
    } else {
        "cash".to_string()
    };

    let event_category = Some(payload.event_type.clone());

    // 3. Extract Data based on Payload Type (Nulling out unused fields)
    let (
        start_month, 
        impact_value, 
        duration_months, 
        likelihood_annual_pct, 
        magnitude, 
        direction, 
        duration_category,
        is_counter_cyclic
    ) = match payload.data {
        EventPayload::Fixed { start_month, impact_value, duration_months } => {
            let val = Decimal::from_str(&impact_value)
                .map_err(|_| AppError::ValidationError("Invalid impact value format".to_string()))?;
            (
                Some(start_month),
                Some(val),
                duration_months,
                None, // Explicitly NULL stochastic fields
                None,
                None,
                None,
                None
            )
        },
        EventPayload::Stochastic { occurrence_probability, magnitude, direction, duration, is_counter_cyclic } => {
            let prob = Decimal::from_str(&occurrence_probability)
                .map_err(|_| AppError::ValidationError("Invalid probability format".to_string()))?;
            (
                None, // Explicitly NULL fixed fields
                None,
                None,
                Some(prob),
                Some(magnitude),
                Some(direction),
                Some(duration),
                is_counter_cyclic
            )
        }
    };

    // 4. Update Event with Tenant Isolation Check
    // We check that the EXISTING event belongs to the tenant before updating it.
    // The new targets are already validated by resolve_targets.
    let updated_event = sqlx::query_as!(
        Event,
        r#"
        UPDATE events SET
            plan_id = $1,
            fund_ids = $2,
            company_ids = $3,
            event_name = $4,
            start_month = $5,
            event_category = $6,
            impact_type = $7,
            impact_value = $8,
            duration_months = $9,
            likelihood_annual_pct = $10,
            magnitude = $11,
            direction = $12,
            duration_category = $13,
            is_counter_cyclic = COALESCE($14, is_counter_cyclic)
        WHERE id = $15
        AND (
            plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $16) OR
            EXISTS (SELECT 1 FROM unnest(fund_ids) fid JOIN funds f ON f.id = fid WHERE f.tenant_id = $16) OR
            EXISTS (SELECT 1 FROM unnest(company_ids) cid JOIN companies c ON c.id = cid WHERE c.tenant_id = $16)
        )
        RETURNING 
            id as "id!", plan_id, fund_ids, company_ids,
            event_name as "event_name!", start_month, 
            event_category, impact_type, 
            impact_value, duration_months, 
            likelihood_annual_pct, magnitude, direction, duration_category,
            is_counter_cyclic,
            created_at as "created_at!"
        "#,
        plan_id,
        fund_ids.as_deref(),
        company_ids.as_deref(),
        payload.event_name,
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
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or(AppError::NotFound("Event not found or access denied".to_string()))?;

    Ok(Json(updated_event))
}

pub async fn get_events(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<GetEventsQuery>,
) -> Result<Json<Vec<Event>>, AppError> {
    // Parse target_ids from comma-separated string
    let target_ids_str = query.target_ids.as_deref().unwrap_or("");
    
    let requested_ids: Vec<Uuid> = target_ids_str
        .split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .filter_map(|s| Uuid::parse_str(s).ok())
        .collect();

    if requested_ids.is_empty() {
        return Ok(Json(vec![]));
    }

    // Validate that the user has access to these targets (Tenant Isolation)
    // We fetch only the IDs that exist and belong to the tenant.
    let valid_targets = sqlx::query!(
        r#"
        SELECT id as "id!" FROM funds WHERE id = ANY($1) AND tenant_id = $2
        UNION
        SELECT id as "id!" FROM companies WHERE id = ANY($1) AND tenant_id = $2
        UNION
        SELECT id as "id!" FROM financial_plans WHERE id = ANY($1) AND tenant_id = $2
        "#,
        &requested_ids,
        claims.tenant_id
    )
    .fetch_all(&pool)
    .await?;

    if valid_targets.is_empty() {
        return Ok(Json(vec![]));
    }

    let valid_ids: Vec<Uuid> = valid_targets.into_iter().map(|r| r.id).collect();

    // Fetch events associated with any of the valid target IDs
    // Using Postgres overlap operator && for arrays and ANY for scalar plan_id
    let events = sqlx::query_as!(
        Event,
        r#"
        SELECT 
            id as "id!", plan_id, fund_ids, company_ids,
            event_name as "event_name!", start_month, 
            event_category, impact_type, 
            impact_value, duration_months, 
            likelihood_annual_pct, magnitude, direction, duration_category,
            is_counter_cyclic,
            created_at as "created_at!"
        FROM events 
        WHERE plan_id = ANY($1) 
           OR fund_ids && $1 
           OR company_ids && $1
        "#,
        &valid_ids
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(events))
}

pub async fn get_event(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Event>, AppError> {
    // Complex check to ensure tenant owns at least one of the linked entities
    let event = sqlx::query_as!(
        Event,
        r#"
        SELECT 
            e.id as "id!", e.plan_id, e.fund_ids, e.company_ids,
            e.event_name as "event_name!", e.start_month, 
            e.event_category, e.impact_type, 
            e.impact_value, e.duration_months, 
            e.likelihood_annual_pct, e.magnitude, e.direction, e.duration_category,
            e.is_counter_cyclic,
            e.created_at as "created_at!"
        FROM events e
        WHERE e.id = $1 
        AND (
            e.plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2) OR
            EXISTS (SELECT 1 FROM unnest(e.fund_ids) fid JOIN funds f ON f.id = fid WHERE f.tenant_id = $2) OR
            EXISTS (SELECT 1 FROM unnest(e.company_ids) cid JOIN companies c ON c.id = cid WHERE c.tenant_id = $2)
        )
        "#,
        id,
        claims.tenant_id
    )
    .fetch_optional(&pool)
    .await?
    .ok_or(AppError::NotFound("Event not found".to_string()))?;

    Ok(Json(event))
}

pub async fn delete_event(
    State(pool): State<Pool<Postgres>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query!(
        r#"
        DELETE FROM events 
        WHERE id = $1 
        AND (
            plan_id IN (SELECT id FROM financial_plans WHERE tenant_id = $2) OR
            EXISTS (SELECT 1 FROM unnest(fund_ids) fid JOIN funds f ON f.id = fid WHERE f.tenant_id = $2) OR
            EXISTS (SELECT 1 FROM unnest(company_ids) cid JOIN companies c ON c.id = cid WHERE c.tenant_id = $2)
        )
        "#,
        id,
        claims.tenant_id
    )
    .execute(&pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Event not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
