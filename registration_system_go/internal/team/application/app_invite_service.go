package application

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"
	"time"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

// AppTeamInviteTTL 邀请码有效期：7 天，过期需重新分享。
const AppTeamInviteTTL = 7 * 24 * time.Hour

// inviteCodeDomain 邀请码签名用途隔离，避免与其他 HMAC 场景互相冒用。
const inviteCodeDomain = "team-invite/v1"

// AppTeamInviteView 邀请码解析结果：仅球队公开信息 + 当前用户是否已在队。
type AppTeamInviteView struct {
	TeamID           int64
	Name             string
	Description      *string
	LogoURL          *string
	RequiresPassword bool
	IsMember         bool
}

// AppTeamInviteRepository 邀请链路所需的最小仓储能力。
type AppTeamInviteRepository interface {
	FindByID(ctx context.Context, teamID int64) (domain.Team, bool, error)
	FindActiveMember(ctx context.Context, teamID int64, userID int64) (domain.Member, bool, error)
	FindJoinPasswordHash(ctx context.Context, teamID int64) (*string, bool, error)
}

// AppInviteService 球队邀请码签发与解析。码为无状态 HMAC 签名（teamID+过期时间），
// 不落库；密钥复用 JWT_SECRET，部署侧无需新增配置。
type AppInviteService struct {
	repository AppTeamInviteRepository
	secret     []byte
	now        func() time.Time
}

func NewAppInviteService(repository AppTeamInviteRepository, secret []byte) *AppInviteService {
	return &AppInviteService{repository: repository, secret: secret, now: time.Now}
}

// Issue 为在队成员签发邀请码；码格式 "teamID.expiresUnix.base64url(hmac)"。
func (s *AppInviteService) Issue(ctx context.Context, actor sharedauth.Actor, teamID int64) (string, time.Time, error) {
	if _, err := s.authorizeMember(ctx, actor, teamID); err != nil {
		return "", time.Time{}, err
	}
	expiresAt := s.now().Add(AppTeamInviteTTL)
	code := s.sign(teamID, expiresAt)
	return code, expiresAt, nil
}

// Resolve 校验邀请码并返回球队公开信息；码无效/过期一律 Forbidden，球队不存在返回 NotFound。
func (s *AppInviteService) Resolve(ctx context.Context, actor sharedauth.Actor, code string) (AppTeamInviteView, error) {
	if !actor.IsUser() {
		return AppTeamInviteView{}, sharederror.ErrForbidden
	}
	teamID, ok := s.verify(code)
	if !ok {
		return AppTeamInviteView{}, sharederror.New(sharederror.KindForbidden, "邀请码无效或已过期")
	}
	team, found, err := s.repository.FindByID(ctx, teamID)
	if err != nil {
		return AppTeamInviteView{}, sharederror.Wrap(sharederror.KindInternal, "查询球队失败", err)
	}
	if !found {
		return AppTeamInviteView{}, sharederror.New(sharederror.KindNotFound, "球队不存在")
	}
	if team.Status != domain.TeamActive {
		return AppTeamInviteView{}, sharederror.ErrForbidden
	}
	hash, found, err := s.repository.FindJoinPasswordHash(ctx, teamID)
	if err != nil {
		return AppTeamInviteView{}, sharederror.Wrap(sharederror.KindInternal, "查询入队口令失败", err)
	}
	if !found {
		return AppTeamInviteView{}, sharederror.New(sharederror.KindNotFound, "球队不存在")
	}
	_, isMember, err := s.repository.FindActiveMember(ctx, teamID, actor.ID)
	if err != nil {
		return AppTeamInviteView{}, sharederror.Wrap(sharederror.KindInternal, "查询球队权限失败", err)
	}
	return AppTeamInviteView{
		TeamID:           team.ID,
		Name:             team.Name,
		Description:      team.Description,
		LogoURL:          team.LogoURL,
		RequiresPassword: hash != nil,
		IsMember:         isMember,
	}, nil
}

func (s *AppInviteService) authorizeMember(ctx context.Context, actor sharedauth.Actor, teamID int64) (domain.Member, error) {
	if !actor.IsUser() {
		return domain.Member{}, sharederror.ErrForbidden
	}
	team, found, err := s.repository.FindByID(ctx, teamID)
	if err != nil {
		return domain.Member{}, sharederror.Wrap(sharederror.KindInternal, "查询球队失败", err)
	}
	if !found {
		return domain.Member{}, sharederror.New(sharederror.KindNotFound, "球队不存在")
	}
	if team.Status != domain.TeamActive {
		return domain.Member{}, sharederror.ErrForbidden
	}
	member, found, err := s.repository.FindActiveMember(ctx, teamID, actor.ID)
	if err != nil {
		return domain.Member{}, sharederror.Wrap(sharederror.KindInternal, "查询球队权限失败", err)
	}
	if !found {
		return domain.Member{}, sharederror.New(sharederror.KindForbidden, "仅球队成员可分享邀请")
	}
	return member, nil
}

func (s *AppInviteService) sign(teamID int64, expiresAt time.Time) string {
	payload := fmt.Sprintf("%s:%d:%d", inviteCodeDomain, teamID, expiresAt.Unix())
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(payload))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return fmt.Sprintf("%d.%d.%s", teamID, expiresAt.Unix(), signature)
}

func (s *AppInviteService) verify(code string) (int64, bool) {
	parts := strings.Split(code, ".")
	if len(parts) != 3 {
		return 0, false
	}
	teamID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || teamID <= 0 {
		return 0, false
	}
	expiresUnix, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return 0, false
	}
	if s.now().Unix() >= expiresUnix {
		return 0, false
	}
	expected := s.sign(teamID, time.Unix(expiresUnix, 0).UTC())
	if !hmac.Equal([]byte(expected), []byte(code)) {
		return 0, false
	}
	return teamID, true
}
