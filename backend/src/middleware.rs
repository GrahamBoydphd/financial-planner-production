use axum::{
    extract::Request,
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use crate::models::Claims;
use jsonwebtoken::{decode, DecodingKey, Validation};
use std::env;

pub async fn auth(
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // 1. Extract Authorization header
    let token = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|header_val| {
            if header_val.starts_with("Bearer ") {
                Some(&header_val[7..])
            } else {
                None
            }
        });

    let token = match token {
        Some(t) => t,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    // 2. Decode JWT
    let secret = env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
    let decoding_key = DecodingKey::from_secret(secret.as_bytes());
    let validation = Validation::default();

    let token_data = match decode::<Claims>(token, &decoding_key, &validation) {
        Ok(data) => data,
        Err(_) => return Err(StatusCode::UNAUTHORIZED),
    };

    // 3. Insert Claims into extensions
    req.extensions_mut().insert(token_data.claims);

    // 4. Call next middleware/handler
    Ok(next.run(req).await)
}
