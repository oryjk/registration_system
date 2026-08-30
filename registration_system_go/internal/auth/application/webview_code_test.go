package application

import (
	"context"
	"errors"
	"regexp"
	"testing"
	"time"

	authdomain "github.com/oryjk/registration_system/registration_system_go/internal/auth/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestWebviewCodeIssueRequiresUserActor(t *testing.T) {
	service := NewWebviewCodeService(&fakeWebviewCodeRepository{}, &fakeWebviewCodeTokens{})

	if _, err := service.Issue(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("Issue() error=%v, want forbidden", err)
	}
}

func TestWebviewCodeIssueStoresHashAndReturnsPlainCode(t *testing.T) {
	repository := &fakeWebviewCodeRepository{}
	service := NewWebviewCodeService(repository, &fakeWebviewCodeTokens{})
	now := time.Date(2026, 8, 30, 12, 0, 0, 0, time.UTC)
	service.now = func() time.Time { return now }
	actor := sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 37}

	result, err := service.Issue(context.Background(), actor)
	if err != nil {
		t.Fatalf("Issue() error=%v", err)
	}
	if matched := regexp.MustCompile(`^[0-9a-f]{64}$`).MatchString(result.Code); !matched {
		t.Fatalf("code 应为 32 字节 hex（64 个十六进制字符），得到 %q", result.Code)
	}
	if !result.ExpiresAt.Equal(now.Add(WebviewCodeTTL)) {
		t.Fatalf("expires_at 应为 now+TTL，得到 %v", result.ExpiresAt)
	}
	if repository.created.UserID != 37 {
		t.Fatalf("存储的 user_id 应为 37，得到 %d", repository.created.UserID)
	}
	if repository.created.CodeHash == result.Code {
		t.Fatal("数据库不得存储明文 code")
	}
	if repository.created.CodeHash != authdomain.HashWebviewCode(result.Code) {
		t.Fatalf("存储的应为明文 code 的 SHA-256 hex，得到 %q", repository.created.CodeHash)
	}
	if !repository.created.ExpiresAt.Equal(result.ExpiresAt) {
		t.Fatalf("存储的过期时间应一致: %+v", repository.created)
	}

	again, err := service.Issue(context.Background(), actor)
	if err != nil {
		t.Fatalf("Issue() error=%v", err)
	}
	if again.Code == result.Code {
		t.Fatal("两次签发的 code 不应相同")
	}
}

func TestWebviewCodeExchangeIssuesUserToken(t *testing.T) {
	repository := &fakeWebviewCodeRepository{consumedUserID: 37, consumed: true}
	tokens := &fakeWebviewCodeTokens{}
	service := NewWebviewCodeService(repository, tokens)

	result, err := service.Exchange(context.Background(), "some-code")
	if err != nil {
		t.Fatalf("Exchange() error=%v", err)
	}
	if result.Token != "user-token" || tokens.userID != 37 {
		t.Fatalf("result=%+v token_user=%d", result, tokens.userID)
	}
	if repository.consumedHash != authdomain.HashWebviewCode("some-code") {
		t.Fatalf("消费应使用 SHA-256 哈希查询，得到 %q", repository.consumedHash)
	}
}

func TestWebviewCodeExchangeRejectsInvalidUsedExpiredAndBlankCodes(t *testing.T) {
	repository := &fakeWebviewCodeRepository{consumed: false}
	service := NewWebviewCodeService(repository, &fakeWebviewCodeTokens{})

	// 无效 / 已用 / 过期统一 401，不区分原因。
	if _, err := service.Exchange(context.Background(), "unknown"); !errors.Is(err, sharederror.ErrUnauthorized) {
		t.Fatalf("Exchange() error=%v, want unauthorized", err)
	}
	// 空 code 同样按无效处理，且不触发仓储消费。
	if _, err := service.Exchange(context.Background(), "   "); !errors.Is(err, sharederror.ErrUnauthorized) {
		t.Fatalf("Exchange() error=%v, want unauthorized", err)
	}
	if repository.consumeCalls != 1 {
		t.Fatalf("空 code 不应访问仓储，consume 调用次数=%d", repository.consumeCalls)
	}
}

type fakeWebviewCodeRepository struct {
	created        authdomain.WebviewCode
	consumedUserID int64
	consumed       bool
	consumedHash   string
	consumeCalls   int
}

func (f *fakeWebviewCodeRepository) Create(_ context.Context, code authdomain.WebviewCode) error {
	f.created = code
	return nil
}

func (f *fakeWebviewCodeRepository) Consume(_ context.Context, codeHash string) (int64, bool, error) {
	f.consumeCalls++
	f.consumedHash = codeHash
	return f.consumedUserID, f.consumed, nil
}

type fakeWebviewCodeTokens struct{ userID int64 }

func (f *fakeWebviewCodeTokens) IssueUser(_ context.Context, userID int64) (string, error) {
	f.userID = userID
	return "user-token", nil
}

func (*fakeWebviewCodeTokens) IssueAdmin(context.Context, int64, bool) (string, error) {
	return "", nil
}
func (*fakeWebviewCodeTokens) Parse(context.Context, string) (sharedauth.Actor, error) {
	return sharedauth.Actor{}, nil
}

var _ ports.WebviewCodeRepository = (*fakeWebviewCodeRepository)(nil)
var _ ports.TokenService = (*fakeWebviewCodeTokens)(nil)
