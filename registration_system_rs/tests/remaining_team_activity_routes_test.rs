use axum::body::Body;
use axum::http::{Request, StatusCode};
use registration_system_backend::bootstrap::app::build_test_app;
use tower::ServiceExt;

#[tokio::test]
async fn team_and_activity_routes_are_exposed() {
    let app = build_test_app("0.1.0");

    let team_search = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/admin/teams/search?keyword=test")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_ne!(team_search.status(), StatusCode::NOT_FOUND);

    let password_info = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/admin/teams/team-1/password-info")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_ne!(password_info.status(), StatusCode::NOT_FOUND);

    let check_ongoing = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/admin/activities/check-ongoing")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_ne!(check_ongoing.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn activity_admin_mutation_route_requires_auth_instead_of_404() {
    let app = build_test_app("0.1.0");

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri("/api/admin/activities/activity-1/user/12/stand")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"stand":1,"registration_count":1}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let checkin_config = app
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri("/api/activity/activity-1/check-in-config")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"team_id":"team-1","enabled":true,"radius_meters":200,"open_minutes_before":60,"close_minutes_after":45}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(checkin_config.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn mini_program_routes_are_exposed_under_api_prefix() {
    let app = build_test_app("0.1.0");

    for (method, uri, body) in [
        (
            "POST",
            "/api/user/login",
            Some(r#"{"open_id":"mini-user"}"#),
        ),
        ("GET", "/api/teams/search?keyword=test", None),
        ("GET", "/api/activity/check-ongoing", None),
        (
            "POST",
            "/api/activity/activity-1/check-in",
            Some(r#"{"team_id":"team-1","latitude":30.6,"longitude":104.0}"#),
        ),
        ("GET", "/api/challenges?team_id=team-1", None),
        ("POST", "/api/wx/login", Some(r#"{"js_code":"mini-code"}"#)),
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

#[tokio::test]
async fn mini_program_prefix_does_not_expose_admin_only_routes() {
    let app = build_test_app("0.1.0");

    for (method, uri, body) in [
        ("GET", "/api/teams/team-1/admin-detail", None),
        ("GET", "/api/teams/team-1/admin-managers", None),
        ("GET", "/api/user/players", None),
        ("GET", "/api/activity/activity-1/registrations", None),
        (
            "PATCH",
            "/api/activity/activity-1/registrations/batch",
            Some(r#"{"user_ids":[1],"stand":1}"#),
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

        assert_eq!(
            response.status(),
            StatusCode::NOT_FOUND,
            "admin-only route {uri} should not be exposed under /api"
        );
    }
}
