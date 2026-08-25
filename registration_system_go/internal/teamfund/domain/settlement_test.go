package domain

import (
	"errors"
	"testing"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func settlementAttendees() []Attendee {
	return []Attendee{
		{UserID: 2, Nickname: "主队乙", TeamID: 10},
		{UserID: 1, Nickname: "主队甲", TeamID: 10},
		{UserID: 3, Nickname: "客队丙", TeamID: 20},
		{UserID: 4, Nickname: "散人", TeamID: 0},
		{UserID: 5, Nickname: "已预付", TeamID: 10, Paid: true},
	}
}

func isValidation(err error) bool {
	return errors.Is(err, sharederror.ErrValidation)
}

func TestBuildChargesHappyPath(t *testing.T) {
	charges, err := BuildCharges(settlementAttendees(), map[int64]int64{1: 3000, 2: 0, 3: 3000})
	if err != nil {
		t.Fatal(err)
	}
	if len(charges) != 3 {
		t.Fatalf("应只含有球队且未预付的人: %+v", charges)
	}
	if charges[0].UserID != 1 || charges[1].UserID != 2 || charges[2].UserID != 3 {
		t.Fatalf("应按 (team,user) 排序: %+v", charges)
	}
	if charges[1].AmountCents != 0 {
		t.Fatalf("0 表示免付应保留: %+v", charges)
	}
	if charges[0].TeamID != 10 || charges[2].TeamID != 20 {
		t.Fatalf("球队归属应正确: %+v", charges)
	}
}

func TestBuildChargesRejectsBadInput(t *testing.T) {
	cases := []struct {
		name  string
		items map[int64]int64
	}{
		{"缺员", map[int64]int64{1: 100, 3: 100}},
		{"多人（散人）", map[int64]int64{1: 100, 2: 100, 3: 100, 4: 100}},
		{"多人（已预付）", map[int64]int64{1: 100, 2: 100, 3: 100, 5: 100}},
		{"陌生人", map[int64]int64{1: 100, 2: 100, 3: 100, 99: 100}},
		{"负数金额", map[int64]int64{1: -1, 2: 0, 3: 0}},
		{"全部为 0", map[int64]int64{1: 0, 2: 0, 3: 0}},
		{"空名单", map[int64]int64{}},
	}
	for _, tc := range cases {
		if _, err := BuildCharges(settlementAttendees(), tc.items); !isValidation(err) {
			t.Fatalf("%s: 应返回校验错误，得到 %v", tc.name, err)
		}
	}
}
