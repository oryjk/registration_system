CREATE TABLE IF NOT EXISTS rs_system_runtime_configs (
    config_key VARCHAR(64) PRIMARY KEY,
    config_value JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO rs_system_runtime_configs (config_key, config_value)
VALUES (
    'mini_app',
    '{
      "home": {
        "match_card_limit": 2,
        "challenge_card_limit": 2,
        "activity_fetch_page_size": 100,
        "hide_matches_after_holding_time": true
      },
      "matches": {
        "related_activity_limit": 2,
        "participant_avatar_limit": 5,
        "capacity_extra_slots": 2
      },
      "checkin": {
        "default_radius_meters": 200,
        "default_open_minutes_before": 60,
        "default_close_minutes_after": 45
      },
      "billing": {
        "recent_order_limit": 10
      },
      "notifications": {
        "list_limit": 50
      }
    }'::jsonb
)
ON CONFLICT (config_key) DO NOTHING;
