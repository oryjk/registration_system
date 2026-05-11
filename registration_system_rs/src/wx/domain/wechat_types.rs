#[derive(Debug, Clone)]
pub struct WechatLoginSession {
    pub openid: String,
    pub session_key: Option<String>,
    pub unionid: Option<String>,
}

#[derive(Debug, Clone)]
pub struct WechatAccessToken {
    pub access_token: String,
    pub expires_in: i64,
}

#[derive(Debug, Clone)]
pub struct PhoneNumberResult {
    pub phone_number: String,
}
