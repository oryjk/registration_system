package domain

// SettlementAttendee 结算名单候选行：TeamID 为 0 表示散人（individual_opponent 组），
// Paid 为 true 表示已通过赛前报名费支付、结算时跳过。
type SettlementAttendee struct {
	UserID   int64
	Nickname string
	TeamID   int64
	Paid     bool
}
