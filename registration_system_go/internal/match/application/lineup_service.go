package application

import (
	"context"
	"encoding/hex"
	"time"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

const lineupMiniCodePage = "pages/matches/lineup/index"

// LineupView 组合已保存的比赛阵型和阵型中涉及的主力/替补用户信息。
type LineupView struct {
	Lineup  domain.MatchLineup
	Players []ports.LineupPlayer
}

// LineupService 编排比赛排阵型的读取、保存与小程序码生成。
type LineupService struct {
	repository ports.LineupRepository
	authorizer TeamManagerAuthorizer
	codes      ports.LineupMiniCodeGenerator
	clock      ports.Clock
}

func NewLineupService(
	repository ports.LineupRepository,
	authorizer TeamManagerAuthorizer,
	codes ports.LineupMiniCodeGenerator,
	clock ports.Clock,
) *LineupService {
	return &LineupService{
		repository: repository,
		authorizer: authorizer,
		codes:      codes,
		clock:      clock,
	}
}

// Get 任何已登录用户可查看指定比赛的已保存阵型（供队员与替补查看站位和替换关系）。
func (s *LineupService) Get(ctx context.Context, actor sharedauth.Actor, matchID uuid.UUID) (LineupView, bool, error) {
	if !actor.IsUser() {
		return LineupView{}, false, sharederror.ErrForbidden
	}
	if _, found, err := s.repository.FindMatch(ctx, matchID); err != nil {
		return LineupView{}, false, sharederror.Wrap(sharederror.KindInternal, "查询比赛失败", err)
	} else if !found {
		return LineupView{}, false, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}

	lineup, found, err := s.repository.FindLineup(ctx, matchID)
	if err != nil {
		return LineupView{}, false, sharederror.Wrap(sharederror.KindInternal, "查询比赛阵型失败", err)
	}
	if !found {
		return LineupView{}, false, nil
	}
	lineup.Slots = domain.NormalizeLineupSlots(lineup.Slots)

	players, err := s.loadPlayers(ctx, lineup.Slots)
	if err != nil {
		return LineupView{}, false, err
	}
	return LineupView{Lineup: lineup, Players: players}, true, nil
}

// Save 保存比赛阵型；权限规则与 UserMatchUpdateService.UpdateDetails 保持完全一致。
func (s *LineupService) Save(ctx context.Context, actor sharedauth.Actor, matchID uuid.UUID, formation string, slots []domain.LineupSlot) (LineupView, error) {
	if !actor.IsUser() {
		return LineupView{}, sharederror.ErrForbidden
	}
	match, found, err := s.repository.FindMatch(ctx, matchID)
	if err != nil {
		return LineupView{}, sharederror.Wrap(sharederror.KindInternal, "查询比赛失败", err)
	}
	if !found {
		return LineupView{}, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}

	if err := s.authorizeEdit(ctx, actor, match); err != nil {
		return LineupView{}, err
	}
	if match.Status == domain.MatchEnded || match.Status == domain.MatchCancelled {
		return LineupView{}, sharederror.New(sharederror.KindConflict, "已结束或已取消的比赛不能修改阵型")
	}

	now := time.Now().UTC()
	if s.clock != nil {
		now = s.clock.Now().UTC()
	}
	lineup, err := domain.NewMatchLineup(matchID, match.PlayersPerTeam, formation, slots, actor.ID, now)
	if err != nil {
		return LineupView{}, err
	}

	saved, err := s.repository.UpsertLineup(ctx, lineup)
	if err != nil {
		return LineupView{}, sharederror.Wrap(sharederror.KindInternal, "保存比赛阵型失败", err)
	}
	saved.Slots = domain.NormalizeLineupSlots(saved.Slots)

	players, err := s.loadPlayers(ctx, saved.Slots)
	if err != nil {
		return LineupView{}, err
	}
	return LineupView{Lineup: saved, Players: players}, nil
}

// GenerateMiniCode 为比赛排阵页面生成微信小程序码，使用无横杠 32 位 hex matchID 作为 scene。
func (s *LineupService) GenerateMiniCode(ctx context.Context, actor sharedauth.Actor, matchID uuid.UUID, environment string) (string, error) {
	if !actor.IsUser() {
		return "", sharederror.ErrForbidden
	}
	if environment != "release" && environment != "trial" && environment != "develop" {
		return "", sharederror.New(sharederror.KindValidation, "小程序版本无效")
	}
	if _, found, err := s.repository.FindMatch(ctx, matchID); err != nil {
		return "", sharederror.Wrap(sharederror.KindInternal, "查询比赛失败", err)
	} else if !found {
		return "", sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	if s.codes == nil {
		return "", sharederror.New(sharederror.KindInternal, "阵型小程序码暂时不可用")
	}
	scene := hex.EncodeToString(matchID[:])
	imageURL, err := s.codes.GenerateForPage(ctx, lineupMiniCodePage, scene, environment)
	if err != nil {
		return "", sharederror.Wrap(sharederror.KindInternal, "生成小程序码失败，请稍后重试", err)
	}
	return imageURL, nil
}

func (s *LineupService) authorizeEdit(ctx context.Context, actor sharedauth.Actor, match domain.Match) error {
	if match.PublicationMode == domain.OnlinePickup || match.PublicationMode == domain.VenueHosted {
		if match.CreatedByUserID == nil || *match.CreatedByUserID != actor.ID {
			return sharederror.ErrForbidden
		}
		return nil
	}
	if match.HostTeamID == nil || s.authorizer == nil {
		return sharederror.ErrForbidden
	}
	return s.authorizer.EnsureManager(ctx, *match.HostTeamID, actor.ID)
}

func (s *LineupService) loadPlayers(ctx context.Context, slots []domain.LineupSlot) ([]ports.LineupPlayer, error) {
	ids := domain.CollectLineupPlayerIDs(slots)
	if len(ids) == 0 {
		return []ports.LineupPlayer{}, nil
	}
	players, err := s.repository.FindUsersByIDs(ctx, ids)
	if err != nil {
		return nil, sharederror.Wrap(sharederror.KindInternal, "查询阵型球员信息失败", err)
	}
	if players == nil {
		return []ports.LineupPlayer{}, nil
	}
	return players, nil
}
