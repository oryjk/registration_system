use super::dto::{
    AdminLoginApiResponse, AdminLoginRequest, AdminRegisterRequest, AdminUserApiResponse,
    AdminUserListApiResponse, EmptyApiResponse, ErrorApiResponse, UpdateAdminStatusRequest,
    VerifyTokenApiResponse,
};
#[allow(unused_imports)]
use super::handlers::{
    __path_delete_admin_handler, __path_list_admins_handler, __path_login_handler,
    __path_logout_handler, __path_register_handler, __path_update_admin_status_handler,
    __path_verify_handler,
};
use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
use utoipa::{Modify, OpenApi};

#[derive(OpenApi)]
#[openapi(
    paths(
        super::handlers::login_handler,
        super::handlers::verify_handler,
        super::handlers::register_handler,
        super::handlers::logout_handler,
        super::handlers::list_admins_handler,
        super::handlers::update_admin_status_handler,
        super::handlers::delete_admin_handler
    ),
    components(
        schemas(
            AdminLoginRequest,
            AdminRegisterRequest,
            UpdateAdminStatusRequest,
            super::dto::AdminUserDto,
            super::dto::VerifyTokenResponse,
            super::dto::AdminLoginResponse,
            super::dto::EmptyData,
            ErrorApiResponse,
            EmptyApiResponse,
            AdminUserApiResponse,
            AdminUserListApiResponse,
            VerifyTokenApiResponse,
            AdminLoginApiResponse
        )
    ),
    tags(
        (name = "Auth", description = "后台管理员认证与管理")
    ),
    modifiers(&AuthSecurityAddon)
)]
pub struct AuthApiDoc;

struct AuthSecurityAddon;

impl Modify for AuthSecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        let components = openapi
            .components
            .get_or_insert_with(utoipa::openapi::Components::new);
        components.add_security_scheme(
            "bearer_auth",
            SecurityScheme::Http(
                HttpBuilder::new()
                    .scheme(HttpAuthScheme::Bearer)
                    .bearer_format("JWT")
                    .build(),
            ),
        );
    }
}
