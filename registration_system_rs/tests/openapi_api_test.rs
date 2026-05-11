use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use registration_system_backend::bootstrap::app::build_test_app;
use serde_json::Value;
use tower::ServiceExt;

#[tokio::test]
async fn openapi_route_returns_document() {
    let app = build_test_app("0.1.0");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/openapi.json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn swagger_ui_route_is_available() {
    let app = build_test_app("0.1.0");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/docs/")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn openapi_document_uses_actual_admin_and_app_prefixes() {
    let app = build_test_app("0.1.0");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/openapi.json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let document: Value = serde_json::from_slice(&bytes).unwrap();
    let paths = document["paths"].as_object().unwrap();

    assert!(
        paths.contains_key("/api/admin/auth/login"),
        "OpenAPI 缺少管理后台登录路径"
    );
    assert!(
        paths.contains_key("/api/user/login"),
        "OpenAPI 缺少小程序用户登录路径"
    );
    assert!(
        paths.contains_key("/api/payment/recharge"),
        "OpenAPI 缺少小程序支付路径"
    );
    assert!(
        paths.contains_key("/api/challenges"),
        "OpenAPI 缺少小程序约队列表路径"
    );
    assert!(
        paths.contains_key("/api/notifications"),
        "OpenAPI 缺少小程序通知列表路径"
    );
    assert!(
        paths.contains_key("/api/admin/users/players"),
        "OpenAPI 缺少管理后台球员列表路径"
    );
    assert!(
        !paths.contains_key("/api/user/players"),
        "OpenAPI 不应包含小程序球员管理路径"
    );
    assert!(
        paths.contains_key("/api/admin/challenges"),
        "OpenAPI 缺少管理后台约队路径"
    );
    assert!(
        paths.contains_key("/api/admin/teams/team-1/members/batch")
            || paths.contains_key("/api/admin/teams/{id}/members/batch"),
        "OpenAPI 缺少球队成员批量操作路径"
    );
    assert!(
        paths.contains_key("/api/admin/teams/{id}/admin-managers"),
        "OpenAPI 缺少球队管理员分配路径"
    );
    assert!(
        paths.contains_key("/api/admin/teams/admin-list"),
        "OpenAPI 缺少管理后台球队管理列表路径"
    );
    assert!(
        !paths.contains_key("/api/teams/admin-list"),
        "OpenAPI 不应包含小程序球队管理列表路径"
    );
    assert!(
        !paths.contains_key("/api/teams/{id}/admin-detail"),
        "OpenAPI 不应包含小程序球队管理详情路径"
    );
    assert!(
        paths.contains_key("/api/admin/activities/{activity_id}/registrations"),
        "OpenAPI 缺少活动报名记录路径"
    );
    assert!(
        paths.contains_key("/api/admin/activities/{activity_id}/registrations/batch"),
        "OpenAPI 缺少活动报名批量更新路径"
    );
    assert!(
        !paths.contains_key("/api/activity/{activity_id}/registrations"),
        "OpenAPI 不应包含小程序活动报名管理路径"
    );
    assert!(
        !paths.contains_key("/api/activity/{activity_id}/registrations/batch"),
        "OpenAPI 不应包含小程序活动报名批量管理路径"
    );
    assert!(
        paths.contains_key("/api/activity/{activity_id}/check-in"),
        "OpenAPI 缺少小程序活动签到路径"
    );
    assert!(
        paths.contains_key("/api/activity/{activity_id}/check-in-config"),
        "OpenAPI 缺少球队签到配置路径"
    );
    assert!(
        paths.contains_key("/api/user/avatar"),
        "OpenAPI 缺少用户头像上传路径"
    );
    assert!(
        paths.contains_key("/api/admin/activities/location-search"),
        "OpenAPI 缺少管理后台活动地点搜索路径"
    );
    assert!(
        paths.contains_key("/api/admin/activities/location-resolve"),
        "OpenAPI 缺少管理后台活动地点解析路径"
    );
    assert!(
        !paths.contains_key("/api/activity/location-search"),
        "OpenAPI 不应包含小程序活动地点搜索路径"
    );
    assert!(
        !paths.contains_key("/api/activity/location-resolve"),
        "OpenAPI 不应包含小程序活动地点解析路径"
    );
    assert!(
        paths.contains_key("/api/payment/team-membership"),
        "OpenAPI 缺少球队会员充值支付路径"
    );
    assert!(
        paths.contains_key("/api/admin/teams/{id}/credit"),
        "OpenAPI 缺少球队信用概览路径"
    );
    assert!(
        paths.contains_key("/api/admin/teams/{id}/credit/transactions"),
        "OpenAPI 缺少球队信用流水路径"
    );
    assert!(
        paths.contains_key("/api/admin/teams/{id}/credit/reviews"),
        "OpenAPI 缺少球队赛后评价路径"
    );
    assert!(
        paths.contains_key("/api/admin/teams/{id}/credit/membership-recharges"),
        "OpenAPI 缺少球队会员充值路径"
    );
    assert!(
        paths.contains_key("/api/admin/system/map-preview-settings"),
        "OpenAPI 缺少地图预览设置路径"
    );
    assert!(
        paths.contains_key("/api/admin/system/map-settings"),
        "OpenAPI 缺少地图设置路径"
    );
    assert!(
        !paths.contains_key("/api/system/map-settings"),
        "OpenAPI 不应包含不存在的小程序系统设置路径"
    );
    assert!(
        !paths.contains_key("/api/admin/notifications"),
        "OpenAPI 不应包含不存在的管理后台通知路径"
    );
}

#[tokio::test]
async fn auth_openapi_includes_request_and_response_schemas() {
    let app = build_test_app("0.1.0");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/openapi.json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let document: Value = serde_json::from_slice(&bytes).unwrap();
    let login_operation = &document["paths"]["/api/admin/auth/login"]["post"];
    let verify_operation = &document["paths"]["/api/admin/auth/verify"]["post"];
    let components = document["components"]["schemas"].as_object().unwrap();

    assert!(
        login_operation.get("requestBody").is_some(),
        "auth/login 应包含请求体 schema"
    );
    assert!(
        login_operation["responses"]["200"].get("content").is_some(),
        "auth/login 应包含成功响应 schema"
    );
    assert!(
        verify_operation.get("security").is_some(),
        "auth/verify 应声明 bearer 鉴权"
    );
    assert!(
        components.contains_key("AdminLoginRequest"),
        "OpenAPI 缺少 AdminLoginRequest schema"
    );
    assert!(
        components.contains_key("AdminLoginApiResponse"),
        "OpenAPI 缺少 AdminLoginApiResponse schema"
    );
}

#[tokio::test]
async fn non_auth_openapi_includes_real_request_and_response_schemas() {
    let app = build_test_app("0.1.0");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/openapi.json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let document: Value = serde_json::from_slice(&bytes).unwrap();
    let components = document["components"]["schemas"].as_object().unwrap();

    let user_login_operation = &document["paths"]["/api/user/login"]["post"];
    assert!(
        user_login_operation.get("requestBody").is_some(),
        "user/login 应包含请求体 schema"
    );
    assert!(
        user_login_operation["responses"]["200"]
            .get("content")
            .is_some(),
        "user/login 应包含成功响应 schema"
    );
    assert!(
        user_login_operation.get("security").is_none(),
        "user/login 不应要求 bearer 鉴权"
    );
    assert!(
        components.contains_key("UserLoginRequest"),
        "OpenAPI 缺少 UserLoginRequest schema"
    );

    let team_create_operation = &document["paths"]["/api/teams"]["post"];
    assert!(
        team_create_operation.get("requestBody").is_some(),
        "POST /api/teams 应包含请求体 schema"
    );
    assert!(
        team_create_operation["responses"]["200"]
            .get("content")
            .is_some(),
        "POST /api/teams 应包含成功响应 schema"
    );
    assert!(
        team_create_operation.get("security").is_some(),
        "POST /api/teams 应声明 bearer 鉴权"
    );
    assert!(
        components.contains_key("CreateTeamRequest"),
        "OpenAPI 缺少 CreateTeamRequest schema"
    );

    let recharge_operation = &document["paths"]["/api/payment/recharge"]["post"];
    assert!(
        recharge_operation.get("requestBody").is_some(),
        "payment/recharge 应包含请求体 schema"
    );
    assert!(
        recharge_operation["responses"]["200"]
            .get("content")
            .is_some(),
        "payment/recharge 应包含成功响应 schema"
    );
    assert!(
        recharge_operation.get("security").is_some(),
        "payment/recharge 应声明 bearer 鉴权"
    );
    assert!(
        components.contains_key("CreateRechargeOrderRequest"),
        "OpenAPI 缺少 CreateRechargeOrderRequest schema"
    );
}
