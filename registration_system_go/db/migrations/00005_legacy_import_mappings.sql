-- +goose Up
CREATE TABLE legacy_import_mappings (
    source_system TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    source_updated_at TIMESTAMPTZ NULL,
    source_fingerprint TEXT NOT NULL,
    target_fingerprint TEXT NOT NULL,
    fingerprint_version INTEGER NOT NULL DEFAULT 1,
    migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (source_system, entity_type, source_id),
    CONSTRAINT legacy_import_mappings_source_check CHECK (source_system IN ('legacy_mysql', 'legacy_postgres')),
    CONSTRAINT legacy_import_mappings_entity_check CHECK (entity_type IN ('user', 'team', 'membership', 'match', 'registration')),
    CONSTRAINT legacy_import_mappings_source_fingerprint_check CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT legacy_import_mappings_target_fingerprint_check CHECK (target_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT legacy_import_mappings_version_check CHECK (fingerprint_version > 0)
);

CREATE INDEX legacy_import_mappings_target_idx
    ON legacy_import_mappings (entity_type, target_id);

-- +goose Down
DROP TABLE IF EXISTS legacy_import_mappings;
