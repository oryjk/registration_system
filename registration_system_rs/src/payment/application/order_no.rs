pub fn generate_order_no() -> String {
    let timestamp = chrono::Utc::now().timestamp_millis();
    let suffix: u16 = rand::random::<u16>() % 10000;
    format!("{timestamp}{suffix:04}")
}
