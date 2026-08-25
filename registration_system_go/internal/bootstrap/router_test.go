package bootstrap

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	authapplication "github.com/oryjk/registration_system/registration_system_go/internal/auth/application"
	authdomain "github.com/oryjk/registration_system/registration_system_go/internal/auth/domain"
	matchhttp "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/http"
	matchapplication "github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	matchdomain "github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	notificationhttp "github.com/oryjk/registration_system/registration_system_go/internal/notification/adapters/http"
	notificationapplication "github.com/oryjk/registration_system/registration_system_go/internal/notification/application"
	notificationdomain "github.com/oryjk/registration_system/registration_system_go/internal/notification/domain"
	paymenthttp "github.com/oryjk/registration_system/registration_system_go/internal/payment/adapters/http"
	paymentapplication "github.com/oryjk/registration_system/registration_system_go/internal/payment/application"
	paymentdomain "github.com/oryjk/registration_system/registration_system_go/internal/payment/domain"
	paymentports "github.com/oryjk/registration_system/registration_system_go/internal/payment/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	teamfundhttp "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/adapters/http"
	teamfundapplication "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/application"
	teamfundports "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/ports"
	userdomain "github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
	wallethttp "github.com/oryjk/registration_system/registration_system_go/internal/wallet/adapters/http"
	walletapplication "github.com/oryjk/registration_system/registration_system_go/internal/wallet/application"
	walletdomain "github.com/oryjk/registration_system/registration_system_go/internal/wallet/domain"
)

func TestAppUserRegistrationRoutesAreProtectedAndVersioned(t *testing.T) {
	matchID, groupID := uuid.New(), uuid.New()
	registrationService := &routerUserRegistration{registration: matchdomain.Registration{
		GroupID: groupID, UserID: 42, Status: matchdomain.RegistrationAttending,
		RegistrationCount: 1, UpdatedAt: time.Date(2026, 8, 8, 12, 0, 0, 0, time.UTC),
	}}
	middleware := authhttp.NewMiddleware(routerAudienceTokens{})
	router := NewRouter(Dependencies{
		AuthMiddleware:    &middleware,
		UserRegistrations: matchhttp.NewUserRegistrationHandler(registrationService),
	})
	path := "/api/v1/app/matches/" + matchID.String() + "/groups/" + groupID.String() + "/my-registration"

	unauthorized := httptest.NewRecorder()
	router.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodDelete, path, nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized status=%d body=%s", unauthorized.Code, unauthorized.Body.String())
	}

	request := httptest.NewRequest(http.MethodPut, path, bytes.NewBufferString(`{"status":"attending","registration_count":1}`))
	request.Header.Set("Authorization", "Bearer user-token")
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK || registrationService.actor.ID != 42 {
		t.Fatalf("authorized status=%d actor=%+v body=%s", response.Code, registrationService.actor, response.Body.String())
	}

	unversioned := httptest.NewRecorder()
	router.ServeHTTP(unversioned, httptest.NewRequest(http.MethodPut, "/api/app/matches/"+matchID.String()+"/groups/"+groupID.String()+"/my-registration", nil))
	if unversioned.Code != http.StatusNotFound {
		t.Fatalf("unversioned route status=%d", unversioned.Code)
	}
}

func TestHealthRoute(t *testing.T) {
	router := NewRouter(Dependencies{})
	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
	}
	const expected = `{"code":0,"message":"ok","data":{"status":"ok"}}`
	if response.Body.String() != expected {
		t.Fatalf("expected body %s, got %s", expected, response.Body.String())
	}
}

func TestLocalH5PreflightIsAllowed(t *testing.T) {
	router := NewRouter(Dependencies{})
	request := httptest.NewRequest(http.MethodOptions, "/api/v1/app/test-auth/users", nil)
	request.Header.Set("Origin", "http://localhost:5175")
	request.Header.Set("Access-Control-Request-Method", http.MethodGet)
	request.Header.Set("Access-Control-Request-Headers", "authorization,content-type")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("expected preflight status %d, got %d", http.StatusNoContent, response.Code)
	}
	if response.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5175" {
		t.Fatalf("unexpected allow origin %q", response.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestSwaggerRoutesServeEmbeddedOpenAPI(t *testing.T) {
	router := NewRouter(Dependencies{})

	redirect := httptest.NewRecorder()
	router.ServeHTTP(redirect, httptest.NewRequest(http.MethodGet, "/api/docs", nil))
	if redirect.Code < 300 || redirect.Code >= 400 || redirect.Header().Get("Location") != "/api/docs/" {
		t.Fatalf("docs redirect status=%d location=%q", redirect.Code, redirect.Header().Get("Location"))
	}

	for _, test := range []struct {
		path        string
		contentType string
		contains    string
	}{
		{path: "/api/docs/", contentType: "text/html", contains: "Swagger UI"},
		{path: "/api/docs/openapi.yaml", contentType: "application/yaml", contains: "openapi: 3.0.3"},
		{path: "/api/docs/swagger-ui.css", contentType: "text/css"},
	} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, test.path, nil))
		if response.Code != http.StatusOK || !strings.Contains(response.Header().Get("Content-Type"), test.contentType) {
			t.Fatalf("GET %s status=%d content-type=%q", test.path, response.Code, response.Header().Get("Content-Type"))
		}
		if test.contains != "" && !strings.Contains(response.Body.String(), test.contains) {
			t.Fatalf("GET %s body does not contain %q", test.path, test.contains)
		}
	}
}

func TestBusinessRoutesUseVersionedAudiencePrefixesOnly(t *testing.T) {
	router := NewRouter(Dependencies{
		UserAuth:  authhttp.NewHandler(routerWechatLogin{}),
		AdminAuth: authhttp.NewAdminHandler(routerAdminAuth{}),
	})

	tests := []struct {
		method string
		path   string
		want   int
	}{
		{http.MethodPost, "/api/v1/app/auth/wechat/login", http.StatusUnprocessableEntity},
		{http.MethodPost, "/api/v1/admin/auth/login", http.StatusUnprocessableEntity},
		{http.MethodPost, "/api/auth/wechat/login", http.StatusNotFound},
		{http.MethodPost, "/api/admin/auth/login", http.StatusNotFound},
	}
	for _, test := range tests {
		t.Run(test.path, func(t *testing.T) {
			response := httptest.NewRecorder()
			router.ServeHTTP(response, httptest.NewRequest(test.method, test.path, nil))
			if response.Code != test.want {
				t.Fatalf("%s %s returned %d, want %d", test.method, test.path, response.Code, test.want)
			}
		})
	}
}

func TestH5TestAuthRoutesAreRegisteredOnlyWhenEnabled(t *testing.T) {
	testAuth := authhttp.NewTestHandler(routerTestAuth{}, 37)
	for name, test := range map[string]struct {
		enabled bool
		want    int
	}{
		"disabled": {want: http.StatusNotFound},
		"enabled":  {enabled: true, want: http.StatusOK},
	} {
		t.Run(name, func(t *testing.T) {
			router := NewRouter(Dependencies{TestAuth: testAuth, H5TestLoginEnabled: test.enabled})
			response := httptest.NewRecorder()
			router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/app/test-auth/users", nil))
			if response.Code != test.want {
				t.Fatalf("status=%d, want %d", response.Code, test.want)
			}
		})
	}
}

func TestPaymentWalletRoutesUseVersionedAudiencePrefixes(t *testing.T) {
	middleware := authhttp.NewMiddleware(routerAudienceTokens{})
	payment := paymenthttp.NewHandler(routerPaymentService{})
	wallet := wallethttp.NewHandler(routerWalletService{})
	router := NewRouter(Dependencies{AuthMiddleware: &middleware, Payments: payment, Wallets: wallet})
	tests := []struct {
		method string
		path   string
		token  string
	}{
		{http.MethodPost, "/api/v1/app/payments/recharge-orders", "user-token"},
		{http.MethodPost, "/api/v1/app/payments/tip-orders", "user-token"},
		{http.MethodGet, "/api/v1/app/payments/orders", "user-token"},
		{http.MethodGet, "/api/v1/app/payments/orders/P1", "user-token"},
		{http.MethodPost, "/api/v1/app/payments/orders/P1/sync", "user-token"},
		{http.MethodPost, "/api/v1/app/payments/orders/P1/cancel", "user-token"},
		{http.MethodGet, "/api/v1/app/wallet", "user-token"},
		{http.MethodGet, "/api/v1/app/wallet/transactions", "user-token"},
		{http.MethodGet, "/api/v1/admin/payments/orders", "admin-token"},
		{http.MethodGet, "/api/v1/admin/payments/tips", "admin-token"},
		{http.MethodGet, "/api/v1/admin/payments/orders/P1", "admin-token"},
		{http.MethodGet, "/api/v1/admin/wallets/37", "admin-token"},
	}
	for _, test := range tests {
		t.Run(test.method+" "+test.path, func(t *testing.T) {
			var body *bytes.Reader
			if test.path == "/api/v1/app/payments/recharge-orders" || test.path == "/api/v1/app/payments/tip-orders" {
				body = bytes.NewReader([]byte(`{"amount_cents":1}`))
			} else {
				body = bytes.NewReader(nil)
			}
			request := httptest.NewRequest(test.method, test.path, body)
			request.Header.Set("Authorization", "Bearer "+test.token)
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != http.StatusOK {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
		})
	}
	webhook := httptest.NewRecorder()
	router.ServeHTTP(webhook, httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/wechat-pay", strings.NewReader("<xml/>")))
	if webhook.Code != http.StatusOK || !strings.Contains(webhook.Body.String(), "SUCCESS") {
		t.Fatalf("webhook status=%d body=%s", webhook.Code, webhook.Body.String())
	}
	unversioned := httptest.NewRecorder()
	router.ServeHTTP(unversioned, httptest.NewRequest(http.MethodGet, "/api/app/wallet", nil))
	if unversioned.Code != http.StatusNotFound {
		t.Fatalf("unversioned status=%d", unversioned.Code)
	}
}

type routerWechatLogin struct{}

func (routerWechatLogin) Execute(context.Context, string) (authapplication.WechatLoginResult, error) {
	return authapplication.WechatLoginResult{User: userdomain.User{Status: userdomain.StatusActive}}, nil
}

type routerAdminAuth struct{}

type routerTestAuth struct{}

func (routerTestAuth) ListUsers(context.Context, int64) (authapplication.TestLoginUsersResult, error) {
	return authapplication.TestLoginUsersResult{DefaultUserID: 4}, nil
}

func (routerTestAuth) Login(context.Context, int64) (authapplication.TestLoginResult, error) {
	return authapplication.TestLoginResult{}, nil
}

func (routerAdminAuth) Login(context.Context, string, string) (authapplication.AdminLoginResult, error) {
	return authapplication.AdminLoginResult{}, nil
}

func (routerAdminAuth) Current(context.Context, sharedauth.Actor) (authdomain.Admin, error) {
	return authdomain.Admin{}, nil
}

func (routerAdminAuth) CreateAdmin(context.Context, sharedauth.Actor, string, string) (authdomain.Admin, error) {
	return authdomain.Admin{}, nil
}

func (routerAdminAuth) ListAdmins(context.Context, sharedauth.Actor) ([]authdomain.Admin, error) {
	return nil, nil
}

type routerUserTokens struct{}

func (routerUserTokens) IssueUser(context.Context, int64) (string, error)        { return "", nil }
func (routerUserTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (routerUserTokens) Parse(context.Context, string) (sharedauth.Actor, error) {
	return sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, nil
}

type routerPaymentService struct{}

func (routerPaymentService) CreateRecharge(context.Context, sharedauth.Actor, paymentapplication.CreateRechargeCommand) (paymentapplication.CreateRechargeResult, error) {
	return paymentapplication.CreateRechargeResult{}, nil
}
func (routerPaymentService) List(context.Context, sharedauth.Actor, paymentapplication.ListQuery) (paymentapplication.ListResult, error) {
	return paymentapplication.ListResult{}, nil
}
func (routerPaymentService) Get(context.Context, sharedauth.Actor, string) (paymentdomain.Order, error) {
	return paymentdomain.Order{}, nil
}
func (routerPaymentService) Sync(context.Context, sharedauth.Actor, string) (paymentports.SettlementResult, error) {
	return paymentports.SettlementResult{}, nil
}
func (routerPaymentService) Cancel(context.Context, sharedauth.Actor, string) (paymentdomain.Order, error) {
	return paymentdomain.Order{}, nil
}
func (routerPaymentService) HandleNotification(context.Context, []byte) (paymentports.SettlementResult, error) {
	return paymentports.SettlementResult{}, nil
}
func (routerPaymentService) CreateTip(context.Context, sharedauth.Actor, paymentapplication.CreateTipCommand) (paymentapplication.CreateRechargeResult, error) {
	return paymentapplication.CreateRechargeResult{}, nil
}
func (routerPaymentService) ListTips(context.Context, sharedauth.Actor, paymentapplication.TipListQuery) (paymentapplication.TipListResult, error) {
	return paymentapplication.TipListResult{}, nil
}

type routerWalletService struct{}

func (routerWalletService) Get(context.Context, sharedauth.Actor) (walletdomain.Account, error) {
	return walletdomain.Account{}, nil
}
func (routerWalletService) GetForAdmin(context.Context, sharedauth.Actor, int64) (walletdomain.Account, error) {
	return walletdomain.Account{}, nil
}
func (routerWalletService) ListTransactions(context.Context, sharedauth.Actor, walletapplication.TransactionListQuery) (walletapplication.TransactionListResult, error) {
	return walletapplication.TransactionListResult{}, nil
}

type routerAudienceTokens struct{}

func (routerAudienceTokens) IssueUser(context.Context, int64) (string, error)        { return "", nil }
func (routerAudienceTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (routerAudienceTokens) Parse(_ context.Context, token string) (sharedauth.Actor, error) {
	if token == "admin-token" {
		return sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, nil
	}
	return sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, nil
}

type routerUserRegistration struct {
	registration matchdomain.Registration
	actor        sharedauth.Actor
}

func (r *routerUserRegistration) Put(_ context.Context, actor sharedauth.Actor, _, _ uuid.UUID, _ matchapplication.PutMyRegistrationCommand) (matchdomain.Registration, error) {
	r.actor = actor
	return r.registration, nil
}

func (r *routerUserRegistration) Delete(_ context.Context, actor sharedauth.Actor, _, _ uuid.UUID) (matchdomain.Registration, error) {
	r.actor = actor
	return r.registration, nil
}

func (routerPaymentService) CreateTeamMembership(context.Context, sharedauth.Actor, paymentapplication.CreateTeamMembershipCommand) (paymentapplication.CreateRechargeResult, error) {
	return paymentapplication.CreateRechargeResult{}, nil
}

func (routerPaymentService) CreateMatchRegistration(context.Context, sharedauth.Actor, paymentapplication.CreateMatchRegistrationCommand) (paymentapplication.CreateRechargeResult, error) {
	return paymentapplication.CreateRechargeResult{}, nil
}

func TestTeamFundAndNotificationRoutesAreProtectedAndVersioned(t *testing.T) {
	middleware := authhttp.NewMiddleware(routerAudienceTokens{})
	router := NewRouter(Dependencies{
		AuthMiddleware: &middleware,
		TeamFunds:      teamfundhttp.NewHandler(routerTeamFundSettlement{}, routerTeamFundQueries{}, routerTeamFundAdminCredit{}),
		Notifications:  notificationhttp.NewHandler(routerNotificationService{}),
	})
	matchID := uuid.New()
	paths := []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodGet, "/api/v1/app/matches/" + matchID.String() + "/settlement", ""},
		{http.MethodPost, "/api/v1/app/matches/" + matchID.String() + "/settlement", `{"items":[{"user_id":1,"amount_cents":100}]}`},
		{http.MethodGet, "/api/v1/app/team-fund/balances", ""},
		{http.MethodGet, "/api/v1/app/team-fund/transactions?limit=10", ""},
		{http.MethodGet, "/api/v1/app/notifications?limit=50", ""},
		{http.MethodGet, "/api/v1/app/notifications/unread-count", ""},
		{http.MethodPost, "/api/v1/app/notifications/read-all", ""},
	}
	for _, path := range paths {
		t.Run(path.method+" "+path.path, func(t *testing.T) {
			var body io.Reader
			if path.body != "" {
				body = strings.NewReader(path.body)
			}
			request := httptest.NewRequest(path.method, path.path, body)
			request.Header.Set("Authorization", "Bearer user-token")
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != http.StatusOK {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
		})
	}
	unauthorized := httptest.NewRecorder()
	router.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/api/v1/app/team-fund/balances", nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("未登录应返回 401，得到 %d", unauthorized.Code)
	}
	unversioned := httptest.NewRecorder()
	router.ServeHTTP(unversioned, httptest.NewRequest(http.MethodGet, "/api/app/team-fund/balances", nil))
	if unversioned.Code != http.StatusNotFound {
		t.Fatalf("无版本前缀应返回 404，得到 %d", unversioned.Code)
	}
}

type routerTeamFundSettlement struct{}

func (routerTeamFundSettlement) Settle(context.Context, sharedauth.Actor, teamfundapplication.SettlementRequest) (teamfundports.SettleOutcome, error) {
	return teamfundports.SettleOutcome{Items: []teamfundports.SettlementItem{}}, nil
}

func (routerTeamFundSettlement) GetSummary(context.Context, sharedauth.Actor, uuid.UUID) (teamfundports.SettlementSummary, error) {
	return teamfundports.SettlementSummary{Items: []teamfundports.SettlementItem{}, History: []teamfundports.SettlementBatch{}}, nil
}

type routerTeamFundQueries struct{}

func (routerTeamFundQueries) ListBalances(context.Context, sharedauth.Actor) ([]teamfundports.TeamFundBalance, error) {
	return nil, nil
}

func (routerTeamFundQueries) ListTransactions(context.Context, sharedauth.Actor, int64, int) ([]teamfundports.TeamFundTransaction, error) {
	return nil, nil
}

type routerTeamFundAdminCredit struct{}

func (routerTeamFundAdminCredit) Credit(context.Context, sharedauth.Actor, teamfundapplication.AdminCreditRequest) (teamfundports.AdminCreditResult, error) {
	return teamfundports.AdminCreditResult{}, nil
}

func TestAdminTeamFundCreditRouteRequiresAdminToken(t *testing.T) {
	middleware := authhttp.NewMiddleware(routerAudienceTokens{})
	router := NewRouter(Dependencies{
		AuthMiddleware: &middleware,
		TeamFunds:      teamfundhttp.NewHandler(routerTeamFundSettlement{}, routerTeamFundQueries{}, routerTeamFundAdminCredit{}),
	})
	path := "/api/v1/admin/team-fund/credits"

	unauthorized := httptest.NewRecorder()
	router.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"team_id":1,"user_id":2,"amount_cents":100}`)))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("未登录应返回 401，得到 %d", unauthorized.Code)
	}

	forbidden := httptest.NewRecorder()
	userRequest := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"team_id":1,"user_id":2,"amount_cents":100}`))
	userRequest.Header.Set("Authorization", "Bearer user-token")
	router.ServeHTTP(forbidden, userRequest)
	if forbidden.Code != http.StatusForbidden {
		t.Fatalf("普通用户 token 应返回 403，得到 %d body=%s", forbidden.Code, forbidden.Body.String())
	}

	allowed := httptest.NewRecorder()
	adminRequest := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"team_id":1,"user_id":2,"amount_cents":100}`))
	adminRequest.Header.Set("Authorization", "Bearer admin-token")
	adminRequest.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(allowed, adminRequest)
	if allowed.Code != http.StatusOK {
		t.Fatalf("管理员应返回 200，得到 %d body=%s", allowed.Code, allowed.Body.String())
	}
}

type routerNotificationService struct{}

func (routerNotificationService) List(context.Context, sharedauth.Actor, notificationapplication.ListQuery) ([]notificationdomain.Notification, error) {
	return nil, nil
}

func (routerNotificationService) UnreadCount(context.Context, sharedauth.Actor) (int64, error) {
	return 0, nil
}

func (routerNotificationService) MarkAllRead(context.Context, sharedauth.Actor) (int64, error) {
	return 0, nil
}
