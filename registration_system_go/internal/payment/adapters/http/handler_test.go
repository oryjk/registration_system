package paymenthttp

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/ports"
	paymentapplication "github.com/oryjk/registration_system/registration_system_go/internal/payment/application"
	paymentdomain "github.com/oryjk/registration_system/registration_system_go/internal/payment/domain"
	paymentports "github.com/oryjk/registration_system/registration_system_go/internal/payment/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
)

func TestCreateRechargeMapsActorAndIntegerCents(t *testing.T) {
	service := &fakePaymentService{createResult: paymentapplication.CreateRechargeResult{
		Order: mustHTTPOrder(t, "P1", 37, 1), Payment: paymentports.JSAPIParameters{Package: "prepay_id=prepay-1"},
	}}
	router := paymentTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/app/payments/recharge-orders", bytes.NewBufferString(`{"amount_cents":1}`))
	request.Header.Set("Authorization", "Bearer user-token")
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK || service.actor.ID != 37 || service.createCommand.AmountCents != 1 || !strings.Contains(response.Body.String(), `"package":"prepay_id=prepay-1"`) {
		t.Fatalf("status=%d actor=%+v command=%+v body=%s", response.Code, service.actor, service.createCommand, response.Body.String())
	}
}

func TestCreateRechargeMapsProviderFailureToBadGateway(t *testing.T) {
	service := &fakePaymentService{createErr: paymentports.ErrProviderUnavailable}
	router := paymentTestRouter(service)
	request := httptest.NewRequest(http.MethodPost, "/app/payments/recharge-orders", bytes.NewBufferString(`{"amount_cents":1}`))
	request.Header.Set("Authorization", "Bearer user-token")
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusBadGateway {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
}

func TestWebhookReturnsWechatV2XML(t *testing.T) {
	for name, test := range map[string]struct {
		err      error
		contains string
	}{
		"success": {contains: "SUCCESS"},
		"failure": {err: errors.New("settlement failed"), contains: "FAIL"},
	} {
		t.Run(name, func(t *testing.T) {
			service := &fakePaymentService{notificationErr: test.err}
			router := paymentTestRouter(service)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/webhooks/wechat-pay", strings.NewReader("<xml/>")))
			if response.Code != http.StatusOK || !strings.Contains(response.Header().Get("Content-Type"), "xml") || !strings.HasPrefix(response.Body.String(), "<xml>") || !strings.Contains(response.Body.String(), test.contains) {
				t.Fatalf("status=%d type=%q body=%s", response.Code, response.Header().Get("Content-Type"), response.Body.String())
			}
		})
	}
}

func paymentTestRouter(service *fakePaymentService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	middleware := authhttp.NewMiddleware(paymentTokens{})
	handler := NewHandler(service)
	app := router.Group("/app")
	app.Use(middleware.RequireUser())
	handler.RegisterAppRoutes(app)
	admin := router.Group("/admin")
	admin.Use(middleware.RequireAdmin())
	handler.RegisterAdminRoutes(admin)
	handler.RegisterWebhookRoutes(router.Group("/webhooks"))
	return router
}

type paymentTokens struct{}

func (paymentTokens) IssueUser(context.Context, int64) (string, error)        { return "", nil }
func (paymentTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (paymentTokens) Parse(_ context.Context, token string) (sharedauth.Actor, error) {
	if token == "admin-token" {
		return sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, nil
	}
	return sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 37}, nil
}

var _ ports.TokenService = paymentTokens{}

type fakePaymentService struct {
	actor           sharedauth.Actor
	createCommand   paymentapplication.CreateRechargeCommand
	createResult    paymentapplication.CreateRechargeResult
	createErr       error
	notificationErr error
}

func (f *fakePaymentService) CreateRecharge(_ context.Context, actor sharedauth.Actor, command paymentapplication.CreateRechargeCommand) (paymentapplication.CreateRechargeResult, error) {
	f.actor, f.createCommand = actor, command
	return f.createResult, f.createErr
}
func (f *fakePaymentService) List(context.Context, sharedauth.Actor, paymentapplication.ListQuery) (paymentapplication.ListResult, error) {
	return paymentapplication.ListResult{}, nil
}
func (f *fakePaymentService) Get(context.Context, sharedauth.Actor, string) (paymentdomain.Order, error) {
	return paymentdomain.Order{}, nil
}
func (f *fakePaymentService) Sync(context.Context, sharedauth.Actor, string) (paymentports.SettlementResult, error) {
	return paymentports.SettlementResult{}, nil
}
func (f *fakePaymentService) Cancel(context.Context, sharedauth.Actor, string) (paymentdomain.Order, error) {
	return paymentdomain.Order{}, nil
}
func (f *fakePaymentService) HandleNotification(context.Context, []byte) (paymentports.SettlementResult, error) {
	return paymentports.SettlementResult{}, f.notificationErr
}

func mustHTTPOrder(t *testing.T, orderNo string, userID, amount int64) paymentdomain.Order {
	t.Helper()
	order, err := paymentdomain.NewRechargeOrder(orderNo, userID, amount, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	return order
}

func (f *fakePaymentService) CreateTeamMembership(_ context.Context, _ sharedauth.Actor, _ paymentapplication.CreateTeamMembershipCommand) (paymentapplication.CreateRechargeResult, error) {
	return paymentapplication.CreateRechargeResult{}, nil
}

func (s *fakePaymentService) CreateMatchRegistration(context.Context, sharedauth.Actor, paymentapplication.CreateMatchRegistrationCommand) (paymentapplication.CreateRechargeResult, error) {
	return paymentapplication.CreateRechargeResult{}, nil
}
