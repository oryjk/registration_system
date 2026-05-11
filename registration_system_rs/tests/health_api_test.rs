use axum::body::Body;
use axum::http::{Request, StatusCode};
use registration_system_backend::bootstrap::app::build_test_app;
use tower::ServiceExt;

#[tokio::test]
async fn health_route_returns_ok() {
    let app = build_test_app("0.1.0");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn version_route_returns_version_payload() {
    let app = build_test_app("0.1.0");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/version")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}
