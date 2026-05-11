use crate::shared::auth::{ActorKind, Claims};
use crate::shared::error::AppError;
use crate::shared::ports::TokenServicePort;
use chrono::{Duration, Utc};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};

#[derive(Clone)]
pub struct JwtTokenService {
    secret: String,
    issuer: String,
    ttl_seconds: i64,
}

impl JwtTokenService {
    pub fn new(secret: impl Into<String>, issuer: impl Into<String>, ttl_seconds: i64) -> Self {
        Self {
            secret: secret.into(),
            issuer: issuer.into(),
            ttl_seconds,
        }
    }
}

impl TokenServicePort for JwtTokenService {
    fn issue_token(&self, actor_kind: ActorKind, subject_id: i64) -> Result<String, AppError> {
        let now = Utc::now();
        let claims = Claims {
            sub: subject_id,
            actor_kind,
            is_super_admin: None,
            exp: (now + Duration::seconds(self.ttl_seconds)).timestamp() as usize,
            iat: now.timestamp() as usize,
            iss: self.issuer.clone(),
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.secret.as_bytes()),
        )
        .map_err(|error| AppError::internal(format!("生成 JWT 失败: {error}")))
    }

    fn issue_admin_token(&self, subject_id: i64, is_super_admin: bool) -> Result<String, AppError> {
        let now = Utc::now();
        let claims = Claims {
            sub: subject_id,
            actor_kind: ActorKind::Admin,
            is_super_admin: Some(is_super_admin),
            exp: (now + Duration::seconds(self.ttl_seconds)).timestamp() as usize,
            iat: now.timestamp() as usize,
            iss: self.issuer.clone(),
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.secret.as_bytes()),
        )
        .map_err(|error| AppError::internal(format!("生成管理员 JWT 失败: {error}")))
    }

    fn decode_token(&self, token: &str) -> Result<Claims, AppError> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_issuer(std::slice::from_ref(&self.issuer));

        decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.secret.as_bytes()),
            &validation,
        )
        .map(|data| data.claims)
        .map_err(|_| AppError::Unauthorized)
    }
}
