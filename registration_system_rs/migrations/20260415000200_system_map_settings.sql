CREATE TABLE IF NOT EXISTS rs_system_map_settings (
    id SMALLINT PRIMARY KEY,
    selected_provider VARCHAR(16) NOT NULL DEFAULT 'tencent',
    tencent_key VARCHAR(255) NOT NULL DEFAULT '',
    tencent_secret VARCHAR(255) NOT NULL DEFAULT '',
    tencent_web_service_base_url VARCHAR(255) NOT NULL DEFAULT 'https://apis.map.qq.com',
    amap_key VARCHAR(255) NOT NULL DEFAULT '',
    amap_secret VARCHAR(255) NOT NULL DEFAULT '',
    amap_web_service_base_url VARCHAR(255) NOT NULL DEFAULT 'https://restapi.amap.com',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_system_map_settings_singleton CHECK (id = 1),
    CONSTRAINT ck_system_map_provider CHECK (selected_provider IN ('tencent', 'amap'))
);

INSERT INTO rs_system_map_settings (
    id,
    selected_provider,
    tencent_key,
    tencent_secret,
    tencent_web_service_base_url,
    amap_key,
    amap_secret,
    amap_web_service_base_url
)
VALUES (
    1,
    'tencent',
    '',
    '',
    'https://apis.map.qq.com',
    '',
    '',
    'https://restapi.amap.com'
)
ON CONFLICT (id) DO NOTHING;
