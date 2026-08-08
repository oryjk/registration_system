package mapping

import "time"

const FingerprintVersion = 1

type SourceSystem string

const (
	SourceLegacyMySQL    SourceSystem = "legacy_mysql"
	SourceLegacyPostgres SourceSystem = "legacy_postgres"
)

type EntityType string

const (
	EntityUser         EntityType = "user"
	EntityTeam         EntityType = "team"
	EntityMembership   EntityType = "membership"
	EntityMatch        EntityType = "match"
	EntityRegistration EntityType = "registration"
)

type EntityKey struct {
	SourceSystem SourceSystem
	EntityType   EntityType
	SourceID     string
}

type Record struct {
	EntityKey
	TargetID           string
	SourceUpdatedAt    *time.Time
	SourceFingerprint  string
	TargetFingerprint  string
	FingerprintVersion int
	MigratedAt         time.Time
}

type Action string

const (
	ActionCreate         Action = "create"
	ActionAttach         Action = "attach"
	ActionUpdate         Action = "update"
	ActionSkip           Action = "skip"
	ActionTargetModified Action = "target_modified"
	ActionConflict       Action = "conflict"
)

type Decision struct {
	Action   Action
	TargetID string
	Reason   string
}
