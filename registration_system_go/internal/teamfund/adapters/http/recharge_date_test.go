package teamfundhttp

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	teamfundapplication "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/application"
	teamfundports "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/ports"
)

type receiptTokens struct{}

func (receiptTokens) IssueUser(context.Context, int64) (string, error)        { return "", nil }
func (receiptTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (receiptTokens) Parse(context.Context, string) (sharedauth.Actor, error) {
	return sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, nil
}

type receiptManualService struct {
	request teamfundapplication.ManualFundRequest
}

func (s *receiptManualService) Recharge(_ context.Context, _ sharedauth.Actor, request teamfundapplication.ManualFundRequest) (teamfundports.ManualFundResult, error) {
	s.request = request
	return teamfundports.ManualFundResult{BalanceCents: 100, TransactionID: 1}, nil
}
func (*receiptManualService) Consume(context.Context, sharedauth.Actor, teamfundapplication.ManualFundRequest) (teamfundports.ManualFundResult, error) {
	panic("unexpected consumption")
}
func (*receiptManualService) Reverse(context.Context, sharedauth.Actor, teamfundapplication.ManualFundRequest) (teamfundports.ManualFundResult, error) {
	panic("unexpected reversal")
}

func TestAdminCreditAcceptsOptionalReceiptDate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service := &receiptManualService{}
	router := gin.New()
	router.POST("/credits", authhttp.NewMiddleware(receiptTokens{}).RequireAdmin(), NewHandler(nil, nil, service).AdminCredit)
	for _, date := range []string{"", "2025-02-03"} {
		payload := map[string]any{"team_id": 1, "user_id": 2, "amount_cents": 100}
		if date != "" {
			payload["received_on"] = date
		}
		body, _ := json.Marshal(payload)
		request := httptest.NewRequest(http.MethodPost, "/credits", bytes.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Authorization", "Bearer test")
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		if response.Code != http.StatusOK || service.request.ReceivedOn != date {
			t.Fatalf("optional date not forwarded: code=%d request=%+v", response.Code, service.request)
		}
	}
}

func TestTransactionsKeepReceiptAndEntryDatesSeparate(t *testing.T) {
	date := time.Date(2025, 2, 3, 0, 0, 0, 0, time.UTC)
	createdAt := time.Date(2025, 2, 5, 8, 30, 0, 0, time.UTC)
	items := mapFundTransactionItems([]teamfundports.TeamFundTransaction{{ID: 1, ReceivedOn: &date, CreatedAt: createdAt}, {ID: 2, CreatedAt: createdAt}})
	if items[0]["received_on"] != "2025-02-03" || items[0]["created_at"] != createdAt || items[1]["received_on"] != nil {
		t.Fatalf("dates should remain separate and legacy records nullable: %+v", items)
	}
}
