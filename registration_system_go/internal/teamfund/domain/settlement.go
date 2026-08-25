package domain

import (
	"sort"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type Attendee struct {
	UserID   int64
	Nickname string
	TeamID   int64 // 0 = 散人，不参与队费扣款
	Paid     bool  // 赛前报名费已付，结算跳过
}

type Charge struct {
	TeamID      int64
	UserID      int64
	AmountCents int64 // >= 0；0 表示免付
}

// BuildCharges 归一化结算名单：items 必须与「有球队且未预付」的出场者完全一致；
// 每人金额 >= 0，至少一人 > 0；结果按 (TeamID, UserID) 排序以保证加锁顺序稳定。
func BuildCharges(attendees []Attendee, items map[int64]int64) ([]Charge, error) {
	eligible := make([]Attendee, 0, len(attendees))
	for _, attendee := range attendees {
		if attendee.TeamID != 0 && !attendee.Paid {
			eligible = append(eligible, attendee)
		}
	}
	if len(items) != len(eligible) {
		return nil, sharederror.New(sharederror.KindValidation, "结算名单与可扣名单不一致")
	}
	charges := make([]Charge, 0, len(eligible))
	total := int64(0)
	for _, attendee := range eligible {
		amount, ok := items[attendee.UserID]
		if !ok || amount < 0 {
			return nil, sharederror.New(sharederror.KindValidation, "结算金额无效")
		}
		total += amount
		charges = append(charges, Charge{TeamID: attendee.TeamID, UserID: attendee.UserID, AmountCents: amount})
	}
	if total <= 0 {
		return nil, sharederror.New(sharederror.KindValidation, "结算总额需要大于 0")
	}
	sort.Slice(charges, func(i, j int) bool {
		if charges[i].TeamID != charges[j].TeamID {
			return charges[i].TeamID < charges[j].TeamID
		}
		return charges[i].UserID < charges[j].UserID
	})
	return charges, nil
}
