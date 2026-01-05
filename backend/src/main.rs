use axum::{
    routing::{get, post, put, delete},
    Router,
};
use tower_http::cors::{CorsLayer, Any};
use std::net::SocketAddr;
use sqlx::postgres::PgPoolOptions;
use dotenvy::dotenv;

mod models;
mod handlers;
mod errors;
mod projection;
mod distributions;

#[tokio::main]
async fn main() {
    dotenv().ok();
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        // Funds
        .route("/api/funds", post(handlers::funds::create_fund).get(handlers::funds::get_funds))
        .route("/api/funds/:id", get(handlers::funds::get_fund)) // <--- ADD THIS LINE
        .route("/api/funds/:id", delete(handlers::funds::delete_fund))
                
        // Companies
        .route("/api/companies", post(handlers::companies::create_company).get(handlers::companies::get_companies))
        .route("/api/companies/:id", get(handlers::companies::get_company)) // <--- ADD THIS
        .route("/api/companies/:id", delete(handlers::companies::delete_company))
        
        // Plans
        .route("/api/plans", post(handlers::plans::create_plan).get(handlers::plans::get_all_plans))
        .route("/api/plans/:id", get(handlers::plans::get_plan).put(handlers::plans::update_plan).delete(handlers::plans::delete_plan))
        .route("/api/plans/:id/projection", get(handlers::plans::get_plan_projection))
        
        // Revenue (Create, List, Delete+Edit)
        .route("/api/revenue", post(handlers::revenue::create_revenue_item))
        .route("/api/plans/:id/revenue", get(handlers::revenue::get_revenue_items))
        .route("/api/revenue/:id", delete(handlers::revenue::delete_revenue_item).put(handlers::revenue::update_revenue_item))

        // Expenses (Create, List, Delete+Edit)
        .route("/api/expenses", post(handlers::expenses::create_expense_item))
        .route("/api/plans/:id/expenses", get(handlers::expenses::get_expense_items))
        .route("/api/expenses/:id", delete(handlers::expenses::delete_expense_item).put(handlers::expenses::update_expense_item))

        // Capital
        .route("/api/capital", post(handlers::capital::create_capital_injection))
        .route("/api/plans/:id/capital", get(handlers::capital::get_capital_injections))
        .route("/api/capital/:id", delete(handlers::capital::delete_capital_injection))

        // Dividends
        .route("/api/dividends", post(handlers::dividends::upsert_dividend_policy))
        .route("/api/plans/:id/dividends", get(handlers::dividends::get_dividend_policy))

        // Credit
        .route("/api/credit", post(handlers::credit::upsert_credit_facility))
        .route("/api/plans/:id/credit", get(handlers::credit::get_credit_facility))

        // Capital Growth (Treasury) - Note: Handles POST (Insert) and PUT (Update)
        .route(
            "/api/capital-growth", 
            post(handlers::capital_growth::upsert_capital_growth)
            .put(handlers::capital_growth::upsert_capital_growth)
        )
        .route("/api/plans/:id/capital-growth", get(handlers::capital_growth::get_capital_growth))

        // Valuation
        .route("/api/valuation", post(handlers::valuation::create_valuation_assumption))

        // Staffing
        .route("/api/staffing", post(handlers::staffing::create_staffing_role))
        .route("/api/plans/:id/staffing", get(handlers::staffing::get_staffing_roles))
        .route("/api/staffing/:id", delete(handlers::staffing::delete_staffing_role).put(handlers::staffing::update_staffing_role))

        .layer(cors)
        .with_state(pool);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    println!("Server running on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
