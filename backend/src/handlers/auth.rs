use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use uuid::Uuid;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use jsonwebtoken::{encode, EncodingKey, Header};
use std::env;
use crate::errors::AppError;
use crate::models::Claims;

// --- DTOs ---

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
    pub email: String,
    pub full_name: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub username: String,
    pub tenant_id: Uuid,
}

// Internal struct for query mapping
#[derive(sqlx::FromRow)]
struct UserAuthData {
    #[allow(dead_code)]
    id: Uuid,
    password_hash: String,
    tenant_id: Uuid,
}

// --- Handlers ---

pub async fn register(
    State(pool): State<Pool<Postgres>>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    // 1. Hash Password
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(payload.password.as_bytes(), &salt)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?
        .to_string();

    // 2. Start Transaction
    let mut tx = pool.begin().await.map_err(|e| AppError::InternalServerError(e.to_string()))?;

    // 3. Create Tenant
    let tenant_id = Uuid::new_v4();
    // Assuming 'tenants' table exists. Using username as tenant name for MVP.
    sqlx::query("INSERT INTO tenants (id, name, created_at) VALUES ($1, $2, NOW())")
        .bind(tenant_id)
        .bind(&payload.username)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    // 4. Insert User
    let user_id = Uuid::new_v4();
    sqlx::query("INSERT INTO users (id, tenant_id, username, password_hash, email, full_name, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())")
        .bind(user_id)
        .bind(tenant_id)
        .bind(&payload.username)
        .bind(password_hash)
        .bind(&payload.email)
        .bind(&payload.full_name)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    // 5. Commit
    tx.commit().await.map_err(|e| AppError::InternalServerError(e.to_string()))?;

    // 6. Generate JWT
    let token = create_jwt(&payload.username, tenant_id)?;

    Ok(Json(AuthResponse {
        token,
        username: payload.username,
        tenant_id,
    }))
}

pub async fn login(
    State(pool): State<Pool<Postgres>>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    // 1. Find User
    let user_data = sqlx::query_as::<_, UserAuthData>(
        "SELECT id, password_hash, tenant_id FROM users WHERE username = $1"
    )
    .bind(&payload.username)
    .fetch_optional(&pool)
    .await
    .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    let user = match user_data {
        Some(u) => u,
        None => return Err(AppError::AuthError("Invalid credentials".to_string())),
    };

    // 2. Verify Hash
    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    Argon2::default()
        .verify_password(payload.password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::AuthError("Invalid credentials".to_string()))?;

    // 3. Generate JWT
    let token = create_jwt(&payload.username, user.tenant_id)?;

    Ok(Json(AuthResponse {
        token,
        username: payload.username,
        tenant_id: user.tenant_id,
    }))
}

// --- Helpers ---

fn create_jwt(username: &str, tenant_id: Uuid) -> Result<String, AppError> {
    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(24))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: username.to_owned(),
        tenant_id,
        exp: expiration,
    };

    let secret = env::var("JWT_SECRET")
        .map_err(|_| AppError::InternalServerError("JWT_SECRET not set".to_string()))?;

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::InternalServerError(e.to_string()))
}
