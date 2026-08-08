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

func TestAppProfilePatchPreservesOmittedFieldsAndClearsRealName(t *testing.T) {
	realName := "旧姓名"
	user := User{Nickname: "旧昵称", RealName: &realName}
	nickname := "  新昵称  "

	updated, err := user.UpdateAppProfile(&nickname, nil)
	if err != nil {
		t.Fatalf("update nickname: %v", err)
	}
	if updated.Nickname != "新昵称" || updated.RealName == nil || *updated.RealName != "旧姓名" {
		t.Fatalf("unexpected partial update: %+v", updated)
	}

	empty := "   "
	updated, err = updated.UpdateAppProfile(nil, &empty)
	if err != nil {
		t.Fatalf("clear real name: %v", err)
	}
	if updated.Nickname != "新昵称" || updated.RealName != nil {
		t.Fatalf("unexpected cleared profile: %+v", updated)
	}
}

func TestAppProfilePatchRejectsOverlongProvidedFields(t *testing.T) {
	for name, value := range map[string]string{
		"nickname":  strings.Repeat("昵", 121),
		"real name": strings.Repeat("名", 121),
	} {
		t.Run(name, func(t *testing.T) {
			var nickname, realName *string
			if name == "nickname" {
				nickname = &value
			} else {
				realName = &value
			}
			if _, err := (User{}).UpdateAppProfile(nickname, realName); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}
