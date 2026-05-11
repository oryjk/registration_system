use axum::body::Body;
use axum::http::{Request, StatusCode};
use registration_system_backend::bootstrap::app::build_test_app;
use tower::ServiceExt;

#[tokio::test]
async fn billing_routes_require_auth_instead_of_404() {
    let app = build_test_app("0.1.0");

    for (method, uri, expected_status) in [
        (
            "GET",
            "/api/admin/account/1/balance",
            StatusCode::UNAUTHORIZED,
        ),
        (
            "GET",
            "/api/admin/account/transactions",
            StatusCode::UNAUTHORIZED,
        ),
        (
            "GET",
            "/api/admin/orders/users/1/billing-flow",
            StatusCode::UNAUTHORIZED,
        ),
        (
            "GET",
            "/api/admin/orders/activities/billing",
            StatusCode::UNAUTHORIZED,
        ),
        (
            "GET",
            "/api/admin/orders/activities/demo/settlement",
            StatusCode::UNAUTHORIZED,
        ),
        (
            "POST",
            "/api/admin/orders/activities/demo/settlement",
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
        ),
    ] {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri(uri)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(
            response.status(),
            expected_status,
            "route {uri} should exist"
        );
    }
}

#[tokio::test]
async fn mini_program_billing_and_payment_routes_are_exposed() {
    let app = build_test_app("0.1.0");

    for (method, uri, body) in [
        ("GET", "/api/account/balance", None),
        ("GET", "/api/order/my-billing-flow", None),
        ("GET", "/api/notifications/unread-count", None),
        (
            "POST",
            "/api/payment/recharge",
            Some(r#"{"amount":"12.50","openid":"mini-openid"}"#),
        ),
    ] {
        let mut request = Request::builder().method(method).uri(uri);
        if body.is_some() {
            request = request.header("content-type", "application/json");
        }

        let response = app
            .clone()
            .oneshot(
                request
                    .body(Body::from(body.unwrap_or_default().to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_ne!(
            response.status(),
            StatusCode::NOT_FOUND,
            "route {uri} should exist"
        );
    }
}
