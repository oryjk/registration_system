package wallethttp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	walletapplication "github.com/oryjk/registration_system/registration_system_go/internal/wallet/application"
	walletdomain "github.com/oryjk/registration_system/registration_system_go/internal/wallet/domain"
)

func TestGetWalletUsesAuthenticatedUser(t *testing.T) {
	service := &fakeWalletService{account: walletdomain.Account{UserID: 37, BalanceCents: 99}}
	handler := NewHandler(service)
	middleware := authhttp.NewMiddleware(walletTokens{})
	router := gin.New()
	group := router.Group("/app")
	group.Use(middleware.RequireUser())
	handler.RegisterAppRoutes(group)
	request := httptest.NewRequest(http.MethodGet, "/app/wallet", nil)
	request.Header.Set("Authorization", "Bearer user-token")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK || service.actor.ID != 37 || !strings.Contains(response.Body.String(), `"balance_cents":99`) {
		t.Fatalf("status=%d actor=%+v body=%s", response.Code, service.actor, response.Body.String())
	}
}

type walletTokens struct{}

func (walletTokens) IssueUser(context.Context, int64) (string, error)        { return "", nil }
func (walletTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (walletTokens) Parse(context.Context, string) (sharedauth.Actor, error) {
	return sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 37}, nil
}

var _ ports.TokenService = walletTokens{}

type fakeWalletService struct {
	actor   sharedauth.Actor
	account walletdomain.Account
}

func (f *fakeWalletService) Get(_ context.Context, actor sharedauth.Actor) (walletdomain.Account, error) {
	f.actor = actor
	return f.account, nil
}
func (f *fakeWalletService) GetForAdmin(context.Context, sharedauth.Actor, int64) (walletdomain.Account, error) {
	return f.account, nil
}
func (f *fakeWalletService) ListTransactions(context.Context, sharedauth.Actor, walletapplication.TransactionListQuery) (walletapplication.TransactionListResult, error) {
	return walletapplication.TransactionListResult{}, nil
}
