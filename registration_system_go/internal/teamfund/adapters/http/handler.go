package teamfundhttp

import (
	"context"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	teamfundapplication "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/application"
	teamfundports "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/ports"
)

type SettlementService interface {
	Settle(ctx context.Context, actor sharedauth.Actor, request teamfundapplication.SettlementRequest) (teamfundports.SettleOutcome, error)
	GetSummary(ctx context.Context, actor sharedauth.Actor, matchID uuid.UUID) (teamfundports.SettlementSummary, error)
}

type QueryService interface {
	ListBalances(ctx context.Context, actor sharedauth.Actor) ([]teamfundports.TeamFundBalance, error)
	ListTransactions(ctx context.Context, actor sharedauth.Actor, beforeID int64, limit int) ([]teamfundports.TeamFundTransaction, error)
}

type AdminCreditService interface {
	Credit(ctx context.Context, actor sharedauth.Actor, request teamfundapplication.AdminCreditRequest) (teamfundports.AdminCreditResult, error)
}

type Handler struct {
	settlements SettlementService
	queries     QueryService
	adminCredit AdminCreditService
}

func NewHandler(settlements SettlementService, queries QueryService, adminCredit AdminCreditService) *Handler {
	return &Handler{settlements: settlements, queries: queries, adminCredit: adminCredit}
}

type settlementItemRequest struct {
	UserID      int64 `json:"user_id"`
	AmountCents int64 `json:"amount_cents"`
}

type settleRequest struct {
	Description string                  `json:"description"`
	Items       []settlementItemRequest `json:"items"`
}

type SettlementItemResponse struct {
	UserID            int64  `json:"user_id"`
	UserName          string `json:"user_name"`
	TeamID            int64  `json:"team_id"`
	AmountCents       int64  `json:"amount_cents"`
	BalanceAfterCents int64  `json:"balance_after_cents"`
}

type SettlementBatchResponse struct {
	BatchNo          int32     `json:"batch_no"`
	OperationType    string    `json:"operation_type"`
	Description      string    `json:"description"`
	TotalAmountCents int64     `json:"total_amount_cents"`
	UserCount        int32     `json:"user_count"`
	CreatedAt        time.Time `json:"created_at"`
}

type SettlementSummaryResponse struct {
	Settled          bool                      `json:"settled"`
	BatchNo          int32                     `json:"batch_no"`
	SettledAt        *time.Time                `json:"settled_at"`
	Description      string                    `json:"description"`
	TotalAmountCents int64                     `json:"total_amount_cents"`
	Items            []SettlementItemResponse  `json:"items"`
	History          []SettlementBatchResponse `json:"history"`
}

func (h *Handler) RegisterAppRoutes(group *gin.RouterGroup) {
	group.GET("/matches/:id/settlement", h.GetSettlement)
	group.POST("/matches/:id/settlement", h.Settle)
	group.GET("/team-fund/balances", h.ListBalances)
	group.GET("/team-fund/transactions", h.ListTransactions)
}

type adminCreditRequest struct {
	TeamID      int64  `json:"team_id"`
	UserID      int64  `json:"user_id"`
	AmountCents int64  `json:"amount_cents"`
	Note        string `json:"note"`
}

// RegisterAdminRoutes 管理端：手动充值队费（纯记账）。
func (h *Handler) RegisterAdminRoutes(group *gin.RouterGroup) {
	group.POST("/team-fund/credits", h.AdminCredit)
}

func (h *Handler) AdminCredit(c *gin.Context) {
	actor, ok := teamfundActor(c)
	if !ok {
		return
	}
	var request adminCreditRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "请求体格式无效"))
		return
	}
	result, err := h.adminCredit.Credit(c.Request.Context(), actor, teamfundapplication.AdminCreditRequest{
		TeamID: request.TeamID, UserID: request.UserID,
		AmountCents: request.AmountCents, Note: request.Note,
	})
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, gin.H{
		"balance_cents": result.BalanceCents, "transaction_id": result.TransactionID,
	})
}

func (h *Handler) GetSettlement(c *gin.Context) {
	actor, ok := teamfundActor(c)
	if !ok {
		return
	}
	matchID, ok := parseMatchID(c)
	if !ok {
		return
	}
	summary, err := h.settlements.GetSummary(c.Request.Context(), actor, matchID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapSummary(summary))
}

func (h *Handler) Settle(c *gin.Context) {
	actor, ok := teamfundActor(c)
	if !ok {
		return
	}
	matchID, ok := parseMatchID(c)
	if !ok {
		return
	}
	var request settleRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "请求体格式无效"))
		return
	}
	items := make(map[int64]int64, len(request.Items))
	for _, item := range request.Items {
		if _, duplicated := items[item.UserID]; duplicated || item.UserID <= 0 {
			sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "结算人员重复或无效"))
			return
		}
		items[item.UserID] = item.AmountCents
	}
	outcome, err := h.settlements.Settle(c.Request.Context(), actor, teamfundapplication.SettlementRequest{
		MatchID: matchID, Description: request.Description, Items: items,
	})
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, gin.H{
		"batch_no":           outcome.BatchNo,
		"reversed_batch_no":  outcome.ReversedBatchNo,
		"description":        outcome.Description,
		"total_amount_cents": outcome.TotalAmountCents,
		"items":              mapItems(outcome.Items),
	})
}

func (h *Handler) ListBalances(c *gin.Context) {
	actor, ok := teamfundActor(c)
	if !ok {
		return
	}
	balances, err := h.queries.ListBalances(c.Request.Context(), actor)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	items := make([]gin.H, 0, len(balances))
	for _, balance := range balances {
		items = append(items, gin.H{
			"team_id": balance.TeamID, "team_name": balance.TeamName, "balance_cents": balance.BalanceCents,
		})
	}
	sharedhttpapi.WriteSuccess(c, items)
}

func (h *Handler) ListTransactions(c *gin.Context) {
	actor, ok := teamfundActor(c)
	if !ok {
		return
	}
	beforeID, _ := strconv.ParseInt(c.Query("before_id"), 10, 64)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "30"))
	transactions, err := h.queries.ListTransactions(c.Request.Context(), actor, beforeID, limit)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	items := make([]gin.H, 0, len(transactions))
	for _, transaction := range transactions {
		item := gin.H{
			"id": transaction.ID, "team_id": transaction.TeamID, "team_name": transaction.TeamName,
			"amount_cents": transaction.AmountCents, "balance_after_cents": transaction.BalanceAfterCents,
			"source": transaction.Source, "description": transaction.Description, "created_at": transaction.CreatedAt,
		}
		if transaction.MatchID != nil {
			item["match_id"] = transaction.MatchID.String()
		} else {
			item["match_id"] = nil
		}
		if transaction.MatchName != "" {
			item["match_name"] = transaction.MatchName
		} else {
			item["match_name"] = nil
		}
		items = append(items, item)
	}
	sharedhttpapi.WriteSuccess(c, items)
}

func teamfundActor(c *gin.Context) (sharedauth.Actor, bool) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
	}
	return actor, ok
}

func parseMatchID(c *gin.Context) (uuid.UUID, bool) {
	matchID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛 ID 无效"))
		return uuid.Nil, false
	}
	return matchID, true
}

func mapSummary(summary teamfundports.SettlementSummary) SettlementSummaryResponse {
	return SettlementSummaryResponse{
		Settled: summary.Settled, BatchNo: summary.BatchNo, SettledAt: summary.SettledAt,
		Description: summary.Description, TotalAmountCents: summary.TotalAmountCents,
		Items: mapItems(summary.Items), History: mapHistory(summary.History),
	}
}

func mapItems(items []teamfundports.SettlementItem) []SettlementItemResponse {
	responses := make([]SettlementItemResponse, 0, len(items))
	for _, item := range items {
		responses = append(responses, SettlementItemResponse{
			UserID: item.UserID, UserName: item.UserName, TeamID: item.TeamID, AmountCents: item.AmountCents,
			BalanceAfterCents: item.BalanceAfterCents,
		})
	}
	return responses
}

func mapHistory(batches []teamfundports.SettlementBatch) []SettlementBatchResponse {
	responses := make([]SettlementBatchResponse, 0, len(batches))
	for _, batch := range batches {
		responses = append(responses, SettlementBatchResponse{
			BatchNo: batch.BatchNo, OperationType: batch.OperationType, Description: batch.Description,
			TotalAmountCents: batch.TotalAmountCents, UserCount: batch.UserCount, CreatedAt: batch.CreatedAt,
		})
	}
	return responses
}
