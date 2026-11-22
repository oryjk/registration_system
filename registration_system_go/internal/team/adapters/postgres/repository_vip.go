package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

// FindVipStatus 查询球队会员到期时间、单次权益余额与默认分享背景地址。
func (r *Repository) FindVipStatus(ctx context.Context, teamID int64) (domain.VipStatus, bool, error) {
	var (
		id                int64
		vipUntil          pgtype.Timestamptz
		vipCredits        int32
		defaultShareBgURL string
	)
	err := r.database.QueryRow(ctx,
		`SELECT id, vip_until, vip_credits, default_share_bg_url FROM teams WHERE id = $1`,
		teamID,
	).Scan(&id, &vipUntil, &vipCredits, &defaultShareBgURL)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.VipStatus{}, false, nil
	}
	if err != nil {
		return domain.VipStatus{}, false, err
	}
	untilPtr := nullableTimestamptz(vipUntil)
	return domain.VipStatus{
		TeamID:            id,
		IsVip:             domain.IsVipActive(untilPtr, time.Now().UTC()),
		VipUntil:          untilPtr,
		VipCredits:        int(vipCredits),
		DefaultShareBgURL: defaultShareBgURL,
	}, true, nil
}

// ConsumeVipCredit 条件原子扣减 1 次球队单次权益；余额不足时返回 false。
func (r *Repository) ConsumeVipCredit(ctx context.Context, teamID int64) (bool, error) {
	tag, err := r.database.Exec(ctx,
		`UPDATE teams SET vip_credits = vip_credits - 1, updated_at = NOW() WHERE id = $1 AND vip_credits > 0`,
		teamID,
	)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// RecordShareBackground 写入球队分享背景资源库（同图重复写入时刷新排序时间）并同步更新球队默认分享背景。
func (r *Repository) RecordShareBackground(ctx context.Context, teamID int64, imageURL string, uploadedByUserID *int64) error {
	tx, err := r.database.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()
	if _, err := tx.Exec(ctx, `
INSERT INTO team_share_backgrounds (team_id, image_url, uploaded_by_user_id)
VALUES ($1, $2, $3)
ON CONFLICT (team_id, image_url) DO UPDATE
SET created_at = NOW(),
    uploaded_by_user_id = COALESCE(EXCLUDED.uploaded_by_user_id, team_share_backgrounds.uploaded_by_user_id)
`, teamID, imageURL, uploadedByUserID); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx,
		`UPDATE teams SET default_share_bg_url = $2, updated_at = NOW() WHERE id = $1`,
		teamID, imageURL,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sharederror.New(sharederror.KindNotFound, "球队不存在")
	}
	return tx.Commit(ctx)
}

// ListShareBackgrounds 查询球队分享背景资源库（按最近上传/选用倒序）及球队默认背景地址。
func (r *Repository) ListShareBackgrounds(ctx context.Context, teamID int64) ([]domain.ShareBackground, string, error) {
	var defaultURL string
	if err := r.database.QueryRow(ctx,
		`SELECT default_share_bg_url FROM teams WHERE id = $1`,
		teamID,
	).Scan(&defaultURL); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, "", sharederror.New(sharederror.KindNotFound, "球队不存在")
		}
		return nil, "", err
	}
	rows, err := r.database.Query(ctx, `
SELECT id, team_id, image_url, uploaded_by_user_id, created_at
FROM team_share_backgrounds
WHERE team_id = $1
ORDER BY created_at DESC, id DESC
LIMIT 50
`, teamID)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()

	items := make([]domain.ShareBackground, 0)
	for rows.Next() {
		var (
			item      domain.ShareBackground
			createdAt pgtype.Timestamptz
		)
		if err := rows.Scan(&item.ID, &item.TeamID, &item.ImageURL, &item.UploadedByUserID, &createdAt); err != nil {
			return nil, "", err
		}
		item.CreatedAt = createdAt.Time
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, "", err
	}
	return items, defaultURL, nil
}

// HasTeamShareBackground 校验图片地址是否已收录在该球队的分享背景资源库中。
func (r *Repository) HasTeamShareBackground(ctx context.Context, teamID int64, imageURL string) (bool, error) {
	var exists bool
	err := r.database.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM team_share_backgrounds WHERE team_id = $1 AND image_url = $2)`,
		teamID, imageURL,
	).Scan(&exists)
	return exists, err
}
