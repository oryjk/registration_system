package application

import (
	"context"
	"strings"
	"time"

	authdomain "github.com/oryjk/registration_system/registration_system_go/internal/auth/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// WebviewCodeTTL 一次性 code 有效期 60 秒。
const WebviewCodeTTL = 60 * time.Second

type WebviewCodeIssueResult struct {
	Code      string
	ExpiresAt time.Time
}

type WebviewCodeExchangeResult struct {
	Token string
}

// WebviewCodeService web-view 一次性 code 的签发与兑换。
type WebviewCodeService struct {
	repository ports.WebviewCodeRepository
	tokens     ports.TokenService
	now        func() time.Time
}

func NewWebviewCodeService(repository ports.WebviewCodeRepository, tokens ports.TokenService) *WebviewCodeService {
	return &WebviewCodeService{repository: repository, tokens: tokens, now: time.Now}
}

// Issue 为当前登录用户签发一次性 code；响应携带明文 code，数据库只存哈希。
func (s *WebviewCodeService) Issue(ctx context.Context, actor sharedauth.Actor) (WebviewCodeIssueResult, error) {
	if !actor.IsUser() {
		return WebviewCodeIssueResult{}, sharederror.ErrForbidden
	}
	plain, hash, err := authdomain.GenerateWebviewCode()
	if err != nil {
		return WebviewCodeIssueResult{}, sharederror.Wrap(sharederror.KindInternal, "生成 web-view code 失败", err)
	}
	expiresAt := s.now().Add(WebviewCodeTTL)
	code, err := authdomain.NewWebviewCode(actor.ID, hash, expiresAt, s.now())
	if err != nil {
		return WebviewCodeIssueResult{}, err
	}
	if err := s.repository.Create(ctx, code); err != nil {
		return WebviewCodeIssueResult{}, sharederror.Wrap(sharederror.KindInternal, "保存 web-view code 失败", err)
	}
	return WebviewCodeIssueResult{Code: plain, ExpiresAt: expiresAt}, nil
}

// Exchange 用一次性 code 兑换用户 JWT；code 无效、已用或已过期统一返回 401，不区分原因。
func (s *WebviewCodeService) Exchange(ctx context.Context, code string) (WebviewCodeExchangeResult, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return WebviewCodeExchangeResult{}, sharederror.New(sharederror.KindUnauthorized, "code 无效或已过期")
	}
	userID, consumed, err := s.repository.Consume(ctx, authdomain.HashWebviewCode(code))
	if err != nil {
		return WebviewCodeExchangeResult{}, sharederror.Wrap(sharederror.KindInternal, "消费 web-view code 失败", err)
	}
	if !consumed {
		return WebviewCodeExchangeResult{}, sharederror.New(sharederror.KindUnauthorized, "code 无效或已过期")
	}
	token, err := s.tokens.IssueUser(ctx, userID)
	if err != nil {
		return WebviewCodeExchangeResult{}, sharederror.Wrap(sharederror.KindInternal, "签发用户令牌失败", err)
	}
	return WebviewCodeExchangeResult{Token: token}, nil
}
