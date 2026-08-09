package wallethttp

import (
	"context"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	walletapplication "github.com/oryjk/registration_system/registration_system_go/internal/wallet/application"
	walletdomain "github.com/oryjk/registration_system/registration_system_go/internal/wallet/domain"
)

type WalletService interface {
	Get(context.Context, sharedauth.Actor) (walletdomain.Account, error)
	GetForAdmin(context.Context, sharedauth.Actor, int64) (walletdomain.Account, error)
	ListTransactions(context.Context, sharedauth.Actor, walletapplication.TransactionListQuery) (walletapplication.TransactionListResult, error)
}

type Handler struct{ service WalletService }

func NewHandler(service WalletService) *Handler { return &Handler{service: service} }

type AccountResponse struct {
	UserID              int64     `json:"user_id"`
	BalanceCents        int64     `json:"balance_cents"`
	TotalRechargedCents int64     `json:"total_recharged_cents"`
	TotalSpentCents     int64     `json:"total_spent_cents"`
	Version             int64     `json:"version"`
	CreatedAt           time.Time `json:"created_at,omitempty"`
	UpdatedAt           time.Time `json:"updated_at,omitempty"`
}

type TransactionResponse struct {
	ID                string                       `json:"id"`
	Direction         walletdomain.Direction       `json:"direction"`
	Type              walletdomain.TransactionType `json:"type"`
	AmountCents       int64                        `json:"amount_cents"`
	BalanceAfterCents int64                        `json:"balance_after_cents"`
	SourceType        string                       `json:"source_type"`
	SourceID          string                       `json:"source_id"`
	Description       string                       `json:"description"`
	CreatedAt         time.Time                    `json:"created_at"`
}

type TransactionListResponse struct {
	Items    []TransactionResponse `json:"items"`
	Total    int64                 `json:"total"`
	Page     int                   `json:"page"`
	PageSize int                   `json:"page_size"`
}

func (h *Handler) RegisterAppRoutes(group *gin.RouterGroup) {
	group.GET("/wallet", h.Get)
	group.GET("/wallet/transactions", h.ListTransactions)
}

func (h *Handler) RegisterAdminRoutes(group *gin.RouterGroup) {
	group.GET("/wallets/:user_id", h.GetForAdmin)
}

func (h *Handler) Get(c *gin.Context) {
	actor, ok := walletActor(c)
	if !ok {
		return
	}
	account, err := h.service.Get(c.Request.Context(), actor)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapAccount(account))
}

func (h *Handler) GetForAdmin(c *gin.Context) {
	actor, ok := walletActor(c)
	if !ok {
		return
	}
	userID, err := strconv.ParseInt(c.Param("user_id"), 10, 64)
	if err != nil || userID <= 0 {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "用户 ID 无效"))
		return
	}
	account, err := h.service.GetForAdmin(c.Request.Context(), actor, userID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapAccount(account))
}

func (h *Handler) ListTransactions(c *gin.Context) {
	actor, ok := walletActor(c)
	if !ok {
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	result, err := h.service.ListTransactions(c.Request.Context(), actor, walletapplication.TransactionListQuery{Page: page, PageSize: pageSize})
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	items := make([]TransactionResponse, 0, len(result.Items))
	for _, transaction := range result.Items {
		items = append(items, TransactionResponse{
			ID: transaction.ID.String(), Direction: transaction.Direction, Type: transaction.Type,
			AmountCents: transaction.AmountCents, BalanceAfterCents: transaction.BalanceAfterCents,
			SourceType: transaction.SourceType, SourceID: transaction.SourceID,
			Description: transaction.Description, CreatedAt: transaction.CreatedAt,
		})
	}
	sharedhttpapi.WriteSuccess(c, TransactionListResponse{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

func walletActor(c *gin.Context) (sharedauth.Actor, bool) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
	}
	return actor, ok
}

func mapAccount(account walletdomain.Account) AccountResponse {
	return AccountResponse{
		UserID: account.UserID, BalanceCents: account.BalanceCents,
		TotalRechargedCents: account.TotalRechargedCents, TotalSpentCents: account.TotalSpentCents,
		Version: account.Version, CreatedAt: account.CreatedAt, UpdatedAt: account.UpdatedAt,
	}
}
