package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	matchsqlc "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/postgres/sqlc"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
)

// 列表与首页装配：管理端/用户端列表过滤、首页进行中与已结束列表，
// 以及避免 N+1 的批量摘要、报名者装配。

func (r *Repository) ListForAdmin(ctx context.Context, filter ports.AdminMatchFilter) ([]ports.AdminMatchItem, error) {
	var status *string
	if filter.Status != nil {
		value := string(*filter.Status)
		status = &value
	}
	rows, err := r.queries.ListMatchesForAdmin(ctx, matchsqlc.ListMatchesForAdminParams{
		Status: status, Search: filter.Search, LimitCount: int32(filter.Limit), OffsetCount: int32(filter.Offset),
	})
	if err != nil {
		return nil, err
	}
	items := make([]ports.AdminMatchItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, ports.AdminMatchItem{
			Match: mapAdminListMatch(row), HostTeamName: row.HostTeamName, AwayTeamName: row.AwayTeamName,
		})
	}
	return items, nil
}

func (r *Repository) CountForAdmin(ctx context.Context, filter ports.AdminMatchFilter) (int64, error) {
	var status *string
	if filter.Status != nil {
		value := string(*filter.Status)
		status = &value
	}
	return r.queries.CountMatchesForAdmin(ctx, matchsqlc.CountMatchesForAdminParams{Status: status, Search: filter.Search})
}

func (r *Repository) ListForUser(ctx context.Context, filter ports.MatchListFilter) ([]ports.MatchItem, error) {
	var status *string
	if filter.Status != nil {
		value := string(*filter.Status)
		status = &value
	}
	rows, err := r.queries.ListMatchesForUser(ctx, matchsqlc.ListMatchesForUserParams{
		Status: status, Search: filter.Search, Scope: string(filter.Scope), UserID: filter.UserID,
		StartsAfter:      pgOptionalTimestamp(filter.StartsAfter),
		PublicationModes: publicationModeStrings(filter.PublicationModes), DateStart: pgOptionalTimestamp(filter.DateStart),
		LimitCount: int32(filter.Limit), OffsetCount: int32(filter.Offset),
	})
	if err != nil {
		return nil, err
	}
	items := make([]ports.MatchItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, ports.MatchItem{
			Match: mapUserListMatch(row), HostTeamName: row.HostTeamName, AwayTeamName: row.AwayTeamName,
		})
	}
	if err := r.attachRegistrationGroupSummaries(ctx, items); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CountForUser(ctx context.Context, filter ports.MatchListFilter) (int64, error) {
	var status *string
	if filter.Status != nil {
		value := string(*filter.Status)
		status = &value
	}
	return r.queries.CountMatchesForUser(ctx, matchsqlc.CountMatchesForUserParams{
		Status: status, Search: filter.Search, Scope: string(filter.Scope), UserID: filter.UserID,
		StartsAfter:      pgOptionalTimestamp(filter.StartsAfter),
		PublicationModes: publicationModeStrings(filter.PublicationModes), DateStart: pgOptionalTimestamp(filter.DateStart),
	})
}

// attachRegistrationGroupSummaries 为用户列表项填充报名组进度摘要；
// 输入必须按指针引用列表元素，摘要按 match_id 归组后回填。
func (r *Repository) attachRegistrationGroupSummaries(ctx context.Context, items []ports.MatchItem) error {
	if len(items) == 0 {
		return nil
	}
	matchIDs := make([]pgtype.UUID, 0, len(items))
	byMatchID := make(map[uuid.UUID][]ports.RegistrationGroupSummary, len(items))
	for _, item := range items {
		matchIDs = append(matchIDs, pgUUID(item.Match.ID))
	}
	rows, err := r.queries.ListRegistrationSummariesForMatches(ctx, matchIDs)
	if err != nil {
		return err
	}
	for _, row := range rows {
		matchID := uuid.UUID(row.MatchID.Bytes)
		byMatchID[matchID] = append(byMatchID[matchID], ports.RegistrationGroupSummary{
			MatchID:        matchID,
			Kind:           domain.GroupKind(row.Kind),
			TeamID:         row.TeamID,
			MinPlayers:     intPointer(row.MinPlayers),
			MaxPlayers:     intPointer(row.MaxPlayers),
			AttendingCount: int(row.AttendingCount),
		})
	}
	for index := range items {
		items[index].RegistrationGroups = byMatchID[items[index].Match.ID]
		if items[index].RegistrationGroups == nil {
			items[index].RegistrationGroups = []ports.RegistrationGroupSummary{}
		}
	}
	return nil
}

func publicationModeStrings(modes []domain.PublicationMode) []string {
	if len(modes) == 0 {
		// sqlc 参数为 text[]；空切片（而非 nil）保证 SQL 中 cardinality 判断生效。
		return []string{}
	}
	values := make([]string, 0, len(modes))
	for _, mode := range modes {
		values = append(values, string(mode))
	}
	return values
}

func (r *Repository) ListHomeActionItems(ctx context.Context, userID int64, limit int) ([]ports.HomeMatchItem, error) {
	rows, err := r.queries.ListHomeActionMatchesForUser(ctx, matchsqlc.ListHomeActionMatchesForUserParams{
		UserID: userID, LimitCount: int32(limit),
	})
	if err != nil {
		return nil, err
	}
	items := make([]ports.HomeMatchItem, 0, len(rows))
	for _, row := range rows {
		group := ports.UserGroupState{
			Group: domain.RegistrationGroup{
				ID: uuid.UUID(row.GroupID.Bytes), MatchID: uuid.UUID(row.ID.Bytes),
				Kind: domain.GroupKind(row.GroupKind), TeamID: row.GroupTeamID,
				MinPlayers: intPointer(row.GroupMinPlayers), MaxPlayers: intPointer(row.GroupMaxPlayers),
				Status: domain.GroupStatus(row.GroupStatus), CreatedAt: row.GroupCreatedAt.Time,
				UpdatedAt: row.GroupUpdatedAt.Time, CancelledAt: timestampPointer(row.GroupCancelledAt),
			},
			AttendingCount: int(row.AttendingCount),
		}
		if row.MyRegistrationID.Valid && row.MyRegistrationStatus != nil && row.MyRegistrationCount != nil {
			group.MyRegistration = &domain.Registration{
				ID: uuid.UUID(row.MyRegistrationID.Bytes), GroupID: uuid.UUID(row.GroupID.Bytes), UserID: userID,
				Status: domain.RegistrationStatus(*row.MyRegistrationStatus), RegistrationCount: int(*row.MyRegistrationCount),
				CreatedAt: row.MyRegistrationCreatedAt.Time, UpdatedAt: row.MyRegistrationUpdatedAt.Time,
				CancelledAt: timestampPointer(row.MyRegistrationCancelledAt),
			}
		}
		items = append(items, ports.HomeMatchItem{
			Item: ports.MatchItem{
				Match: mapHomeActionMatch(row), HostTeamName: row.HostTeamName, AwayTeamName: row.AwayTeamName,
			},
			Group: group,
		})
	}
	if err := r.attachHomeActionParticipants(ctx, items); err != nil {
		return nil, err
	}
	return items, nil
}

// attachHomeActionParticipants 为首页进行中的比赛组批量填充报名者列表：
// 一次 IN 查询按报名先后取每组全部 attending 报名者，避免 N+1。
func (r *Repository) attachHomeActionParticipants(ctx context.Context, items []ports.HomeMatchItem) error {
	if len(items) == 0 {
		return nil
	}
	groupIDs := make([]pgtype.UUID, 0, len(items))
	for _, item := range items {
		groupIDs = append(groupIDs, pgUUID(item.Group.Group.ID))
	}
	rows, err := r.queries.ListHomeActionGroupParticipants(ctx, groupIDs)
	if err != nil {
		return err
	}
	byGroupID := make(map[uuid.UUID][]ports.UserParticipant, len(items))
	for _, row := range rows {
		groupID := uuid.UUID(row.GroupID.Bytes)
		byGroupID[groupID] = append(byGroupID[groupID], ports.UserParticipant{
			UserID: row.UserID, Nickname: row.Nickname, AvatarURL: row.AvatarUrl,
			Status: domain.RegistrationStatus(row.Status),
		})
	}
	for index := range items {
		participants := byGroupID[items[index].Group.Group.ID]
		if participants == nil {
			participants = []ports.UserParticipant{}
		}
		items[index].Group.Participants = participants
	}
	return nil
}

func (r *Repository) ListHomeEndedItems(ctx context.Context, userID int64, limit int) ([]ports.MatchItem, error) {
	rows, err := r.queries.ListHomeEndedMatchesForUser(ctx, matchsqlc.ListHomeEndedMatchesForUserParams{
		UserID: userID, LimitCount: int32(limit),
	})
	if err != nil {
		return nil, err
	}
	items := make([]ports.MatchItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, ports.MatchItem{
			Match: mapHomeEndedMatch(row), HostTeamName: row.HostTeamName, AwayTeamName: row.AwayTeamName,
		})
	}
	if err := r.attachHomeEndedParticipants(ctx, items); err != nil {
		return nil, err
	}
	return items, nil
}

// attachHomeEndedParticipants 为首页已结束比赛批量填充报名者列表：
// 一次 IN 查询合并每场全部报名组，按报名先后取每场全部 attending 报名者，避免 N+1。
func (r *Repository) attachHomeEndedParticipants(ctx context.Context, items []ports.MatchItem) error {
	if len(items) == 0 {
		return nil
	}
	matchIDs := make([]pgtype.UUID, 0, len(items))
	for _, item := range items {
		matchIDs = append(matchIDs, pgUUID(item.Match.ID))
	}
	rows, err := r.queries.ListHomeEndedMatchParticipants(ctx, matchIDs)
	if err != nil {
		return err
	}
	byMatchID := make(map[uuid.UUID][]ports.UserParticipant, len(items))
	seenByMatchID := make(map[uuid.UUID]map[int64]struct{}, len(items))
	for _, row := range rows {
		matchID := uuid.UUID(row.MatchID.Bytes)
		// 同一用户可能出现在比赛的多个报名组中，按 user_id 去重（保留最早报名的一条）。
		seen, ok := seenByMatchID[matchID]
		if !ok {
			seen = make(map[int64]struct{})
			seenByMatchID[matchID] = seen
		}
		if _, exists := seen[row.UserID]; exists {
			continue
		}
		seen[row.UserID] = struct{}{}
		byMatchID[matchID] = append(byMatchID[matchID], ports.UserParticipant{
			UserID: row.UserID, Nickname: row.Nickname, AvatarURL: row.AvatarUrl,
			Status: domain.RegistrationStatus(row.Status),
		})
	}
	for index := range items {
		participants := byMatchID[items[index].Match.ID]
		if participants == nil {
			participants = []ports.UserParticipant{}
		}
		items[index].Participants = participants
	}
	return nil
}

func mapAdminListMatch(row matchsqlc.ListMatchesForAdminRow) domain.Match {
	return domain.Match{
		ID: uuid.UUID(row.ID.Bytes), Name: row.Name, PublicationMode: domain.PublicationMode(row.PublicationMode),
		OpponentState: domain.OpponentState(row.OpponentState), Status: domain.MatchStatus(row.Status),
		HostTeamID: row.HostTeamID, AwayTeamID: row.AwayTeamID, OpponentName: row.OpponentName,
		PlayersPerTeam: int(row.PlayersPerTeam), StartTime: row.StartTime.Time, EndTime: row.EndTime.Time,
		RegistrationStartAt: timestampPointer(row.RegistrationStartAt), RegistrationEndAt: timestampPointer(row.RegistrationEndAt),
		Location: row.Location, LocationLatitude: row.LocationLatitude, LocationLongitude: row.LocationLongitude,
		Description: row.Description, CreatedByUserID: row.CreatedByUserID, CreatedByAdminID: row.CreatedByAdminID,
		CreatedAt: row.CreatedAt.Time, UpdatedAt: row.UpdatedAt.Time,
	}
}

func mapUserListMatch(row matchsqlc.ListMatchesForUserRow) domain.Match {
	return domain.Match{
		ID: uuid.UUID(row.ID.Bytes), Name: row.Name, PublicationMode: domain.PublicationMode(row.PublicationMode),
		OpponentState: domain.OpponentState(row.OpponentState), Status: domain.MatchStatus(row.Status),
		HostTeamID: row.HostTeamID, AwayTeamID: row.AwayTeamID, OpponentName: row.OpponentName,
		PlayersPerTeam: int(row.PlayersPerTeam), StartTime: row.StartTime.Time, EndTime: row.EndTime.Time,
		RegistrationStartAt: timestampPointer(row.RegistrationStartAt), RegistrationEndAt: timestampPointer(row.RegistrationEndAt),
		Location: row.Location, LocationLatitude: row.LocationLatitude, LocationLongitude: row.LocationLongitude,
		Description: row.Description, CreatedByUserID: row.CreatedByUserID, CreatedByAdminID: row.CreatedByAdminID,
		CreatedAt: row.CreatedAt.Time, UpdatedAt: row.UpdatedAt.Time,
	}
}

func mapHomeActionMatch(row matchsqlc.ListHomeActionMatchesForUserRow) domain.Match {
	return domain.Match{
		ID: uuid.UUID(row.ID.Bytes), Name: row.Name, PublicationMode: domain.PublicationMode(row.PublicationMode),
		OpponentState: domain.OpponentState(row.OpponentState), Status: domain.MatchStatus(row.Status),
		HostTeamID: row.HostTeamID, AwayTeamID: row.AwayTeamID, OpponentName: row.OpponentName,
		PlayersPerTeam: int(row.PlayersPerTeam), StartTime: row.StartTime.Time, EndTime: row.EndTime.Time,
		RegistrationStartAt: timestampPointer(row.RegistrationStartAt), RegistrationEndAt: timestampPointer(row.RegistrationEndAt),
		Location: row.Location, LocationLatitude: row.LocationLatitude, LocationLongitude: row.LocationLongitude,
		Description: row.Description, CreatedByUserID: row.CreatedByUserID, CreatedByAdminID: row.CreatedByAdminID,
		CreatedAt: row.CreatedAt.Time, UpdatedAt: row.UpdatedAt.Time,
	}
}

func mapHomeEndedMatch(row matchsqlc.ListHomeEndedMatchesForUserRow) domain.Match {
	return domain.Match{
		ID: uuid.UUID(row.ID.Bytes), Name: row.Name, PublicationMode: domain.PublicationMode(row.PublicationMode),
		OpponentState: domain.OpponentState(row.OpponentState), Status: domain.MatchStatus(row.Status),
		HostTeamID: row.HostTeamID, AwayTeamID: row.AwayTeamID, OpponentName: row.OpponentName,
		PlayersPerTeam: int(row.PlayersPerTeam), StartTime: row.StartTime.Time, EndTime: row.EndTime.Time,
		RegistrationStartAt: timestampPointer(row.RegistrationStartAt), RegistrationEndAt: timestampPointer(row.RegistrationEndAt),
		Location: row.Location, LocationLatitude: row.LocationLatitude, LocationLongitude: row.LocationLongitude,
		Description: row.Description, CreatedByUserID: row.CreatedByUserID, CreatedByAdminID: row.CreatedByAdminID,
		CreatedAt: row.CreatedAt.Time, UpdatedAt: row.UpdatedAt.Time,
	}
}
