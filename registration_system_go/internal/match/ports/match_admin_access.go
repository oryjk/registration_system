package ports

import "context"

// MatchAdminAccess 校验微信用户是否为比赛管理员。
// 比赛管理员由管理端设置（users.is_match_admin），可在小程序端录入比赛比分。
type MatchAdminAccess interface {
	EnsureMatchAdmin(ctx context.Context, userID int64) error
}
