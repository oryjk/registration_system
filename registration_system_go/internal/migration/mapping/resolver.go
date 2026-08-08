package mapping

import "fmt"

type ResolveInput struct {
	Existing                 *Record
	TargetExists             bool
	ExplicitTargetID         string
	ExplicitTargetExists     bool
	DeterministicTargetIDs   []string
	SourceFingerprint        string
	CurrentTargetFingerprint string
}

func Resolve(input ResolveInput) (Decision, error) {
	if input.Existing != nil {
		record := input.Existing
		if record.FingerprintVersion != FingerprintVersion {
			return Decision{}, fmt.Errorf("fingerprint version %d is not supported", record.FingerprintVersion)
		}
		if !input.TargetExists {
			return Decision{}, fmt.Errorf("mapped target %s does not exist", record.TargetID)
		}
		if input.ExplicitTargetID != "" && input.ExplicitTargetID != record.TargetID {
			return Decision{}, fmt.Errorf("explicit target %s conflicts with mapped target %s", input.ExplicitTargetID, record.TargetID)
		}
		sourceChanged := input.SourceFingerprint != record.SourceFingerprint
		targetChanged := input.CurrentTargetFingerprint != record.TargetFingerprint
		switch {
		case sourceChanged && targetChanged:
			return Decision{Action: ActionConflict, TargetID: record.TargetID, Reason: "source_and_target_modified"}, nil
		case sourceChanged:
			return Decision{Action: ActionUpdate, TargetID: record.TargetID, Reason: "source_modified"}, nil
		case targetChanged:
			return Decision{Action: ActionTargetModified, TargetID: record.TargetID, Reason: "target_modified"}, nil
		default:
			return Decision{Action: ActionSkip, TargetID: record.TargetID, Reason: "unchanged"}, nil
		}
	}
	if input.ExplicitTargetID != "" {
		if !input.ExplicitTargetExists {
			return Decision{}, fmt.Errorf("explicit target %s does not exist", input.ExplicitTargetID)
		}
		return Decision{Action: ActionAttach, TargetID: input.ExplicitTargetID, Reason: "explicit_mapping"}, nil
	}
	switch len(input.DeterministicTargetIDs) {
	case 0:
		return Decision{Action: ActionCreate, Reason: "new_target"}, nil
	case 1:
		return Decision{Action: ActionAttach, TargetID: input.DeterministicTargetIDs[0], Reason: "deterministic_match"}, nil
	default:
		return Decision{}, fmt.Errorf("deterministic match is ambiguous: %d targets", len(input.DeterministicTargetIDs))
	}
}
