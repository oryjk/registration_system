package ports

import (
	"context"

	walletdomain "github.com/oryjk/registration_system/registration_system_go/internal/wallet/domain"
)

type TransactionFilter struct {
	UserID int64
	Limit  int
	Offset int
}

type DebitRequest struct {
	UserID      int64
	AmountCents int64
	SourceType  string
	SourceID    string
	Description string
}

type Repository interface {
	GetAccount(context.Context, int64) (walletdomain.Account, error)
	ListTransactions(context.Context, TransactionFilter) ([]walletdomain.Transaction, int64, error)
	Debit(context.Context, DebitRequest) (walletdomain.Account, error)
}
