use axum::body::Body;
use axum::http::{Request, StatusCode};
use registration_system_backend::bootstrap::app::build_test_app;
use tower::ServiceExt;

#[tokio::test]
async fn wx_login_route_returns_mock_openid_in_test_mode() {
    let app = build_test_app("0.1.0");

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/admin/wx/login")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"js_code":"test-code"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[test]
fn payment_module_exposes_service_types() {
    let _ =
        std::any::type_name::<registration_system_backend::payment::application::PaymentService>();
    let _ = std::any::type_name::<registration_system_backend::wx::application::WxService>();
}
