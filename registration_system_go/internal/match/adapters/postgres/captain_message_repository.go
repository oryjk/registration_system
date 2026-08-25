package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	matchsqlc "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/postgres/sqlc"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
)

// 队长留言仓储：数据装配与错误映射，可见性/权限规则在 application 层。

func (r *Repository) AppendCaptainMessage(ctx context.Context, message ports.CaptainMessage) error {
	return r.queries.AppendCaptainMessage(ctx, matchsqlc.AppendCaptainMessageParams{
		ID: pgUUID(message.ID), MatchID: pgUUID(message.MatchID), TeamID: message.TeamID,
		ThreadOwnerUserID: message.ThreadOwnerUserID, SenderUserID: message.SenderUserID,
		Content: message.Content,
	})
}

func (r *Repository) FindCaptainThreadHead(ctx context.Context, threadID uuid.UUID) (ports.CaptainMessage, bool, error) {
	row, err := r.queries.FindCaptainThreadHead(ctx, pgUUID(threadID))
	if errors.Is(err, pgx.ErrNoRows) {
		return ports.CaptainMessage{}, false, nil
	}
	if err != nil {
		return ports.CaptainMessage{}, false, err
	}
	return mapCaptainThreadHead(row), true, nil
}

func (r *Repository) FindCaptainThreadByOwner(ctx context.Context, matchID uuid.UUID, ownerUserID int64) (ports.CaptainMessage, bool, error) {
	row, err := r.queries.FindCaptainThreadByOwner(ctx, matchsqlc.FindCaptainThreadByOwnerParams{
		MatchID: pgUUID(matchID), ThreadOwnerUserID: ownerUserID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return ports.CaptainMessage{}, false, nil
	}
	if err != nil {
		return ports.CaptainMessage{}, false, err
	}
	return mapCaptainThreadByOwner(row), true, nil
}

func mapCaptainThreadHead(row matchsqlc.FindCaptainThreadHeadRow) ports.CaptainMessage {
	return ports.CaptainMessage{
		ID: uuid.UUID(row.ID.Bytes), MatchID: uuid.UUID(row.MatchID.Bytes), TeamID: row.TeamID,
		ThreadOwnerUserID: row.ThreadOwnerUserID, SenderUserID: row.SenderUserID,
		Content: row.Content, CreatedAt: row.CreatedAt.Time,
		MatchName: row.MatchName, HostTeamName: row.HostTeamName,
	}
}

func mapCaptainThreadByOwner(row matchsqlc.FindCaptainThreadByOwnerRow) ports.CaptainMessage {
	return ports.CaptainMessage{
		ID: uuid.UUID(row.ID.Bytes), MatchID: uuid.UUID(row.MatchID.Bytes), TeamID: row.TeamID,
		ThreadOwnerUserID: row.ThreadOwnerUserID, SenderUserID: row.SenderUserID,
		Content: row.Content, CreatedAt: row.CreatedAt.Time,
		MatchName: row.MatchName, HostTeamName: row.HostTeamName,
	}
}

func (r *Repository) ListCaptainMessagesByThread(ctx context.Context, matchID uuid.UUID, ownerUserID int64) ([]ports.CaptainMessage, error) {
	rows, err := r.queries.ListCaptainMessagesByThread(ctx, matchsqlc.ListCaptainMessagesByThreadParams{
		MatchID: pgUUID(matchID), ThreadOwnerUserID: ownerUserID,
	})
	if err != nil {
		return nil, err
	}
	messages := make([]ports.CaptainMessage, 0, len(rows))
	for _, row := range rows {
		messages = append(messages, ports.CaptainMessage{
			ID: uuid.UUID(row.ID.Bytes), MatchID: matchID, TeamID: 0,
			ThreadOwnerUserID: ownerUserID, SenderUserID: row.SenderUserID,
			Content: row.Content, CreatedAt: row.CreatedAt.Time,
			SenderNickname: row.SenderNickname, SenderAvatarURL: row.SenderAvatarUrl,
			SenderIsCaptainSide: row.SenderIsCaptainSide,
		})
	}
	return messages, nil
}

func (r *Repository) ListMyCaptainMessageThreads(ctx context.Context, userID int64, limit, offset int) ([]ports.CaptainMessageThread, error) {
	rows, err := r.queries.ListMyCaptainMessageThreads(ctx, matchsqlc.ListMyCaptainMessageThreadsParams{
		UserID: userID, LimitCount: int32(limit), OffsetCount: int32(offset),
	})
	if err != nil {
		return nil, err
	}
	threads := make([]ports.CaptainMessageThread, 0, len(rows))
	for _, row := range rows {
		threads = append(threads, ports.CaptainMessageThread{
			ID: uuid.UUID(row.ThreadID.Bytes), MatchID: uuid.UUID(row.MatchID.Bytes), TeamID: row.TeamID,
			ThreadOwnerUserID: row.ThreadOwnerUserID, MatchName: row.MatchName, HostTeamName: row.HostTeamName,
			OwnerNickname: row.OwnerNickname, OwnerAvatarURL: row.OwnerAvatarUrl,
			LatestContent: row.LatestContent, LatestSenderIsCaptainSide: row.LatestSenderIsCaptainSide,
			LatestCreatedAt: row.LatestCreatedAt.Time, UnreadCount: row.UnreadCount,
		})
	}
	return threads, nil
}

func (r *Repository) CountMyCaptainMessageThreads(ctx context.Context, userID int64) (int64, error) {
	return r.queries.CountMyCaptainMessageThreads(ctx, userID)
}

func (r *Repository) CountMyUnreadCaptainMessages(ctx context.Context, userID int64) (int64, error) {
	return r.queries.CountMyUnreadCaptainMessages(ctx, userID)
}

func (r *Repository) MarkCaptainThreadRead(ctx context.Context, matchID uuid.UUID, ownerUserID int64, userID int64, readAt time.Time) error {
	return r.queries.UpsertCaptainThreadRead(ctx, matchsqlc.UpsertCaptainThreadReadParams{
		MatchID: pgUUID(matchID), ThreadOwnerUserID: ownerUserID, UserID: userID, LastReadAt: pgTimestamptzUTC(readAt),
	})
}

func pgTimestamptzUTC(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value, Valid: true}
}

func (r *Repository) ListTeamManagerUserIDs(ctx context.Context, teamID int64) ([]int64, error) {
	return r.queries.ListTeamManagerUserIDs(ctx, teamID)
}

func (r *Repository) FindTeamCaptainProfile(ctx context.Context, teamID int64) (ports.CaptainProfile, bool, error) {
	row, err := r.queries.GetTeamCaptainProfile(ctx, teamID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ports.CaptainProfile{}, false, nil
	}
	if err != nil {
		return ports.CaptainProfile{}, false, err
	}
	return ports.CaptainProfile{UserID: row.UserID, Nickname: row.Nickname, AvatarURL: row.AvatarUrl}, true, nil
}

func (r *Repository) FindUserBrief(ctx context.Context, userID int64) (ports.CaptainProfile, bool, error) {
	row, err := r.queries.GetUserBrief(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ports.CaptainProfile{}, false, nil
	}
	if err != nil {
		return ports.CaptainProfile{}, false, err
	}
	return ports.CaptainProfile{UserID: row.UserID, Nickname: row.Nickname, AvatarURL: row.AvatarUrl}, true, nil
}
