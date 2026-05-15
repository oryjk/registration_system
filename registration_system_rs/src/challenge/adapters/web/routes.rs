use crate::bootstrap::app::AppState;
use crate::challenge::adapters::web::handlers::{
    accept_challenge_handler, cancel_challenge_handler, cancel_individual_acceptance_handler,
    create_challenge_handler, get_challenge_detail_handler, list_challenges_handler,
};
use axum::{
    Router,
    routing::{delete, get, post},
};

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            get(list_challenges_handler).post(create_challenge_handler),
        )
        .route("/:id", get(get_challenge_detail_handler))
        .route("/:id/accept", post(accept_challenge_handler))
        .route("/:id/individual-acceptance", delete(cancel_individual_acceptance_handler))
        .route("/:id/cancel", post(cancel_challenge_handler))
}
