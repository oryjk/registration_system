package mapping

import "testing"

func TestResolveExistingMappingClassifiesFingerprintChanges(t *testing.T) {
	tests := []struct {
		name              string
		sourceFingerprint string
		targetFingerprint string
		want              Action
	}{
		{name: "unchanged", sourceFingerprint: "source-old", targetFingerprint: "target-old", want: ActionSkip},
		{name: "source changed", sourceFingerprint: "source-new", targetFingerprint: "target-old", want: ActionUpdate},
		{name: "target changed", sourceFingerprint: "source-old", targetFingerprint: "target-new", want: ActionTargetModified},
		{name: "both changed", sourceFingerprint: "source-new", targetFingerprint: "target-new", want: ActionConflict},
	}
	record := Record{TargetID: "37", SourceFingerprint: "source-old", TargetFingerprint: "target-old", FingerprintVersion: FingerprintVersion}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			decision, err := Resolve(ResolveInput{
				Existing: &record, TargetExists: true,
				SourceFingerprint: test.sourceFingerprint, CurrentTargetFingerprint: test.targetFingerprint,
			})
			if err != nil || decision.Action != test.want || decision.TargetID != "37" {
				t.Fatalf("decision=%+v error=%v", decision, err)
			}
		})
	}
}

func TestResolveHonorsExistingThenExplicitThenUniqueCandidate(t *testing.T) {
	existing := Record{TargetID: "37", SourceFingerprint: "s", TargetFingerprint: "t", FingerprintVersion: FingerprintVersion}
	decision, err := Resolve(ResolveInput{Existing: &existing, TargetExists: true, SourceFingerprint: "s", CurrentTargetFingerprint: "t"})
	if err != nil || decision.TargetID != "37" {
		t.Fatalf("existing mapping lost priority: decision=%+v err=%v", decision, err)
	}
	decision, err = Resolve(ResolveInput{ExplicitTargetID: "99", ExplicitTargetExists: true, DeterministicTargetIDs: []string{"88"}})
	if err != nil || decision.TargetID != "99" || decision.Action != ActionAttach {
		t.Fatalf("explicit mapping lost priority: decision=%+v err=%v", decision, err)
	}
	decision, err = Resolve(ResolveInput{DeterministicTargetIDs: []string{"88"}})
	if err != nil || decision.TargetID != "88" || decision.Action != ActionAttach {
		t.Fatalf("unique candidate not selected: decision=%+v err=%v", decision, err)
	}
	if _, err := Resolve(ResolveInput{DeterministicTargetIDs: []string{"88", "89"}}); err == nil {
		t.Fatal("expected ambiguous deterministic match error")
	}
	if _, err := Resolve(ResolveInput{Existing: &existing, TargetExists: true, ExplicitTargetID: "99"}); err == nil {
		t.Fatal("expected explicit mapping conflict with existing mapping")
	}
}

func TestResolveRejectsMissingMappedTargetAndFingerprintVersionMismatch(t *testing.T) {
	for name, record := range map[string]Record{
		"missing target":   {TargetID: "37", FingerprintVersion: FingerprintVersion},
		"version mismatch": {TargetID: "37", FingerprintVersion: FingerprintVersion + 1},
	} {
		t.Run(name, func(t *testing.T) {
			input := ResolveInput{Existing: &record, TargetExists: name != "missing target"}
			if _, err := Resolve(input); err == nil {
				t.Fatal("expected conflict")
			}
		})
	}
}
