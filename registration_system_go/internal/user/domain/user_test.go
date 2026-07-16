package domain

import (
	"strings"
	"testing"
)

func TestUserProfileNormalizesValues(t *testing.T) {
	user := User{}

	updated, err := user.UpdateProfile("  王小明  ", " 13800138000 ")
	if err != nil {
		t.Fatalf("update profile: %v", err)
	}
	if updated.RealName == nil || *updated.RealName != "王小明" {
		t.Fatalf("unexpected real name: %#v", updated.RealName)
	}
	if updated.PhoneNumber == nil || *updated.PhoneNumber != "13800138000" {
		t.Fatalf("unexpected phone number: %#v", updated.PhoneNumber)
	}

	updated, err = updated.UpdateProfile("   ", "")
	if err != nil {
		t.Fatalf("clear profile: %v", err)
	}
	if updated.RealName != nil || updated.PhoneNumber != nil {
		t.Fatalf("expected nil profile fields: %+v", updated)
	}
}

func TestUserProfileRejectsOverlongValues(t *testing.T) {
	for name, values := range map[string]struct {
		realName    string
		phoneNumber string
	}{
		"real name": {realName: strings.Repeat("名", 121)},
		"phone":     {phoneNumber: strings.Repeat("1", 33)},
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := (User{}).UpdateProfile(values.realName, values.phoneNumber); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}
