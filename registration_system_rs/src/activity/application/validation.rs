use super::error::ActivityApplicationError;

pub(crate) type OptionalCoordinates = (Option<f64>, Option<f64>);
pub(crate) type OptionalCoordinatePatch = (Option<Option<f64>>, Option<Option<f64>>);

pub(crate) fn is_hex_color(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 7 && bytes[0] == b'#' && bytes[1..].iter().all(|byte| byte.is_ascii_hexdigit())
}

pub(crate) fn validate_optional_hex_color(
    value: Option<String>,
    field_name: &str,
) -> Result<Option<String>, ActivityApplicationError> {
    match value {
        Some(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                Ok(None)
            } else if is_hex_color(trimmed) {
                Ok(Some(trimmed.to_ascii_uppercase()))
            } else {
                Err(ActivityApplicationError::Validation(format!(
                    "{field_name}必须是 #RRGGBB 格式"
                )))
            }
        }
        None => Ok(None),
    }
}

pub(crate) fn validate_optional_hex_color_patch(
    value: Option<Option<String>>,
    field_name: &str,
) -> Result<Option<Option<String>>, ActivityApplicationError> {
    match value {
        Some(value) => Ok(Some(validate_optional_hex_color(value, field_name)?)),
        None => Ok(None),
    }
}

pub(crate) fn validate_location_coordinates(
    latitude: Option<f64>,
    longitude: Option<f64>,
) -> Result<OptionalCoordinates, ActivityApplicationError> {
    match (latitude, longitude) {
        (None, None) => Ok((None, None)),
        (Some(_), None) | (None, Some(_)) => Err(ActivityApplicationError::Validation(
            "地点经纬度必须同时提供".to_string(),
        )),
        (Some(latitude), Some(longitude)) => {
            if !(-90.0..=90.0).contains(&latitude) {
                return Err(ActivityApplicationError::Validation(
                    "地点纬度超出有效范围".to_string(),
                ));
            }
            if !(-180.0..=180.0).contains(&longitude) {
                return Err(ActivityApplicationError::Validation(
                    "地点经度超出有效范围".to_string(),
                ));
            }
            Ok((Some(latitude), Some(longitude)))
        }
    }
}

pub(crate) fn validate_location_coordinates_patch(
    latitude: Option<Option<f64>>,
    longitude: Option<Option<f64>>,
) -> Result<OptionalCoordinatePatch, ActivityApplicationError> {
    match (latitude, longitude) {
        (None, None) => Ok((None, None)),
        (Some(_), None) | (None, Some(_)) => Err(ActivityApplicationError::Validation(
            "地点经纬度必须同时更新".to_string(),
        )),
        (Some(None), Some(None)) => Ok((Some(None), Some(None))),
        (Some(Some(latitude)), Some(Some(longitude))) => {
            let (latitude, longitude) =
                validate_location_coordinates(Some(latitude), Some(longitude))?;
            Ok((Some(latitude), Some(longitude)))
        }
        _ => Err(ActivityApplicationError::Validation(
            "地点经纬度必须同时提供或同时清空".to_string(),
        )),
    }
}

pub(crate) fn validate_checkin_radius(radius_meters: i32) -> Result<i32, ActivityApplicationError> {
    if !(50..=5000).contains(&radius_meters) {
        return Err(ActivityApplicationError::Validation(
            "签到半径必须在 50 到 5000 米之间".to_string(),
        ));
    }
    Ok(radius_meters)
}

pub(crate) fn validate_checkin_window_minutes(
    open_minutes_before: i32,
    close_minutes_after: i32,
) -> Result<(i32, i32), ActivityApplicationError> {
    if !(0..=1440).contains(&open_minutes_before) {
        return Err(ActivityApplicationError::Validation(
            "签到开放时间必须在比赛前 0 到 1440 分钟之间".to_string(),
        ));
    }
    if !(0..=1440).contains(&close_minutes_after) {
        return Err(ActivityApplicationError::Validation(
            "签到截止时间必须在比赛后 0 到 1440 分钟之间".to_string(),
        ));
    }
    Ok((open_minutes_before, close_minutes_after))
}

pub(crate) fn haversine_distance_meters(
    latitude_a: f64,
    longitude_a: f64,
    latitude_b: f64,
    longitude_b: f64,
) -> i32 {
    let earth_radius_meters = 6_371_000.0_f64;
    let lat_a = latitude_a.to_radians();
    let lat_b = latitude_b.to_radians();
    let delta_lat = (latitude_b - latitude_a).to_radians();
    let delta_lng = (longitude_b - longitude_a).to_radians();

    let sin_lat = (delta_lat / 2.0).sin();
    let sin_lng = (delta_lng / 2.0).sin();
    let a = sin_lat * sin_lat + lat_a.cos() * lat_b.cos() * sin_lng * sin_lng;
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());

    (earth_radius_meters * c).round() as i32
}

pub(crate) fn normalize_match_kind(
    value: Option<String>,
) -> Result<String, ActivityApplicationError> {
    match value
        .as_deref()
        .map(str::trim)
        .filter(|item| !item.is_empty())
    {
        None => Ok("external".to_string()),
        Some("external") => Ok("external".to_string()),
        Some("internal") => Ok("internal".to_string()),
        Some(_) => Err(ActivityApplicationError::Validation(
            "比赛类型必须是 external 或 internal".to_string(),
        )),
    }
}

#[cfg(test)]
pub(crate) fn is_frozen_during_activity(
    activity_holding_date: chrono::NaiveDateTime,
    freeze_start_time: Option<chrono::NaiveDateTime>,
    freeze_end_time: Option<chrono::NaiveDateTime>,
) -> bool {
    match freeze_start_time {
        Some(start) if start <= activity_holding_date => {
            freeze_end_time.is_none_or(|end| end >= activity_holding_date)
        }
        _ => false,
    }
}
