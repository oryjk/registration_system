package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
)

var _ ports.ShareBgRepository = (*Repository)(nil)

const queryUpdateMatchShareBgImage = `
UPDATE matches
SET share_bg_image_url = $2,
    share_bg_unlocked = $3,
    updated_at = NOW()
WHERE id = $1
`

// UpdateShareBgImage 更新比赛自定义分享卡背景图 URL 与单场解锁状态。
func (r *Repository) UpdateShareBgImage(ctx context.Context, matchID uuid.UUID, imageURL string, unlocked bool) error {
	_, err := r.database.Exec(ctx, queryUpdateMatchShareBgImage, pgUUID(matchID), imageURL, unlocked)
	return err
}
