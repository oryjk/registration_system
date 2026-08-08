package mapping

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrMappingConflict = errors.New("legacy import mapping conflict")

type Store struct {
	tx pgx.Tx
}

func NewStore(tx pgx.Tx) Store { return Store{tx: tx} }

func (s Store) Find(ctx context.Context, key EntityKey) (Record, bool, error) {
	var record Record
	record.EntityKey = key
	err := s.tx.QueryRow(ctx, `
        SELECT target_id, source_updated_at, source_fingerprint, target_fingerprint,
               fingerprint_version, migrated_at
        FROM legacy_import_mappings
        WHERE source_system=$1 AND entity_type=$2 AND source_id=$3`,
		key.SourceSystem, key.EntityType, key.SourceID,
	).Scan(
		&record.TargetID, &record.SourceUpdatedAt, &record.SourceFingerprint,
		&record.TargetFingerprint, &record.FingerprintVersion, &record.MigratedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Record{}, false, nil
	}
	if err != nil {
		return Record{}, false, fmt.Errorf("find legacy mapping: %w", err)
	}
	return record, true, nil
}

func (s Store) Upsert(ctx context.Context, record Record) error {
	if record.FingerprintVersion == 0 {
		record.FingerprintVersion = FingerprintVersion
	}
	if record.MigratedAt.IsZero() {
		record.MigratedAt = time.Now().UTC()
	}
	result, err := s.tx.Exec(ctx, `
        INSERT INTO legacy_import_mappings (
            source_system, entity_type, source_id, target_id, source_updated_at,
            source_fingerprint, target_fingerprint, fingerprint_version, migrated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (source_system, entity_type, source_id) DO UPDATE SET
            source_updated_at=EXCLUDED.source_updated_at,
            source_fingerprint=EXCLUDED.source_fingerprint,
            target_fingerprint=EXCLUDED.target_fingerprint,
            fingerprint_version=EXCLUDED.fingerprint_version,
            migrated_at=EXCLUDED.migrated_at
        WHERE legacy_import_mappings.target_id=EXCLUDED.target_id`,
		record.SourceSystem, record.EntityType, record.SourceID, record.TargetID,
		record.SourceUpdatedAt, record.SourceFingerprint, record.TargetFingerprint,
		record.FingerprintVersion, record.MigratedAt,
	)
	if err != nil {
		return fmt.Errorf("upsert legacy mapping: %w", err)
	}
	if result.RowsAffected() != 1 {
		return ErrMappingConflict
	}
	return nil
}

func (s Store) ListOwnedTargetIDs(ctx context.Context, source SourceSystem, entity EntityType) (map[string]string, error) {
	rows, err := s.tx.Query(ctx, `
        SELECT source_id, target_id
        FROM legacy_import_mappings
        WHERE source_system=$1 AND entity_type=$2
        ORDER BY source_id`, source, entity)
	if err != nil {
		return nil, fmt.Errorf("list legacy mappings: %w", err)
	}
	defer rows.Close()
	result := make(map[string]string)
	for rows.Next() {
		var sourceID, targetID string
		if err := rows.Scan(&sourceID, &targetID); err != nil {
			return nil, fmt.Errorf("scan legacy mapping: %w", err)
		}
		result[sourceID] = targetID
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate legacy mappings: %w", err)
	}
	return result, nil
}
