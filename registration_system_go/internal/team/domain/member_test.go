package domain

import "testing"

func TestDirectlyAssignableMemberRolesExcludeCaptain(t *testing.T) {
	tests := []struct {
		role Role
		want bool
	}{
		{role: RoleCaptain, want: false},
		{role: RoleLeader, want: true},
		{role: RoleViceCaptain, want: true},
		{role: RoleMember, want: true},
		{role: Role("unknown"), want: false},
	}

	for _, test := range tests {
		if got := test.role.CanAssignDirectly(); got != test.want {
			t.Fatalf("role %q assignable=%t, want %t", test.role, got, test.want)
		}
	}
}

func TestMemberStatusValidation(t *testing.T) {
	if !MemberActive.IsValid() || !MemberInactive.IsValid() {
		t.Fatal("expected known member statuses to be valid")
	}
	if MemberStatus("unknown").IsValid() {
		t.Fatal("expected unknown member status to be invalid")
	}
}
