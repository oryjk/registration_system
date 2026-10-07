package application

import (
	"context"
	"encoding/base64"
	"errors"
	"github.com/google/uuid"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/ports"
	"time"
)

type HonorShareView struct {
	domain.HonorShare
	Code     string
	IsMember bool
}
type HonorShareService struct {
	repository ports.HonorShareRepository
	codes      ports.HonorCodeGenerator
	now        func() time.Time
}

func NewHonorShareService(repository ports.HonorShareRepository, codes ports.HonorCodeGenerator) *HonorShareService {
	return &HonorShareService{repository: repository, codes: codes, now: time.Now}
}
func (s *HonorShareService) Issue(ctx context.Context, actor sharedauth.Actor, teamID int64) (HonorShareView, error) {
	if !actor.IsUser() || teamID <= 0 {
		return HonorShareView{}, sharederror.ErrForbidden
	}
	if _, found, err := s.repository.FindActiveMember(ctx, teamID, actor.ID); err != nil {
		return HonorShareView{}, sharederror.Wrap(sharederror.KindInternal, "查询球队成员失败", err)
	} else if !found {
		return HonorShareView{}, sharederror.ErrForbidden
	}
	year := int32(s.now().In(time.FixedZone("Asia/Shanghai", 8*60*60)).Year())
	id, err := s.repository.CreateHonorShare(ctx, teamID, actor.ID, year)
	if err != nil {
		if errors.Is(err, sharederror.ErrForbidden) {
			return HonorShareView{}, sharederror.ErrForbidden
		}
		return HonorShareView{}, sharederror.Wrap(sharederror.KindInternal, "创建荣誉分享失败", err)
	}
	return s.Resolve(ctx, actor, base64.RawURLEncoding.EncodeToString(id[:]))
}
func (s *HonorShareService) Resolve(ctx context.Context, actor sharedauth.Actor, code string) (HonorShareView, error) {
	if !actor.IsUser() {
		return HonorShareView{}, sharederror.ErrForbidden
	}
	raw, err := base64.RawURLEncoding.Strict().DecodeString(code)
	if err != nil || len(raw) != 16 || len(code) != 22 {
		return HonorShareView{}, sharederror.New(sharederror.KindNotFound, "荣誉分享无效或已失效")
	}
	id, err := uuid.FromBytes(raw)
	if err != nil || id == uuid.Nil {
		return HonorShareView{}, sharederror.New(sharederror.KindNotFound, "荣誉分享无效或已失效")
	}
	record, found, err := s.repository.FindHonorShare(ctx, id)
	if err != nil {
		return HonorShareView{}, sharederror.Wrap(sharederror.KindInternal, "读取荣誉失败", err)
	}
	if !found {
		return HonorShareView{}, sharederror.New(sharederror.KindNotFound, "荣誉分享无效或已失效")
	}
	_, isMember, err := s.repository.FindActiveMember(ctx, record.TeamID, actor.ID)
	if err != nil {
		return HonorShareView{}, sharederror.Wrap(sharederror.KindInternal, "查询球队成员失败", err)
	}
	return HonorShareView{HonorShare: record, Code: code, IsMember: isMember}, nil
}
func (s *HonorShareService) MiniCode(ctx context.Context, actor sharedauth.Actor, code, environment string) (string, error) {
	view, err := s.Resolve(ctx, actor, code)
	if err != nil {
		return "", err
	}
	if view.UserID != actor.ID {
		return "", sharederror.ErrForbidden
	}
	if environment != "release" && environment != "trial" && environment != "develop" {
		return "", sharederror.New(sharederror.KindValidation, "小程序版本无效")
	}
	if s.codes == nil {
		return "", sharederror.New(sharederror.KindInternal, "海报小程序码暂时不可用")
	}
	url, err := s.codes.Generate(ctx, code, environment)
	if err != nil {
		return "", sharederror.Wrap(sharederror.KindInternal, "生成小程序码失败，请稍后重试", err)
	}
	return url, nil
}
