package domain

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

var ErrInsufficientBalance = errors.New("insufficient wallet balance")

type Direction string

const (
	DirectionCredit Direction = "credit"
	DirectionDebit  Direction = "debit"
)

type TransactionType string

const (
	TransactionRecharge TransactionType = "recharge"
	TransactionSpend    TransactionType = "spend"
)

type Account struct {
	UserID              int64
	BalanceCents        int64
	TotalRechargedCents int64
	TotalSpentCents     int64
	Version             int64
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

type Transaction struct {
	ID                uuid.UUID
	UserID            int64
	Direction         Direction
	Type              TransactionType
	AmountCents       int64
	BalanceAfterCents int64
	SourceType        string
	SourceID          string
	Description       string
	CreatedAt         time.Time
}

func (a *Account) Debit(amountCents int64, sourceType, sourceID, description string, now time.Time) (Transaction, error) {
	if amountCents < 1 || strings.TrimSpace(sourceType) == "" || strings.TrimSpace(sourceID) == "" {
		return Transaction{}, sharederror.New(sharederror.KindValidation, "钱包扣费参数无效")
	}
	if a.BalanceCents < amountCents {
		return Transaction{}, ErrInsufficientBalance
	}
	a.BalanceCents -= amountCents
	a.TotalSpentCents += amountCents
	a.Version++
	a.UpdatedAt = now
	return Transaction{
		ID: uuid.New(), UserID: a.UserID, Direction: DirectionDebit, Type: TransactionSpend,
		AmountCents: amountCents, BalanceAfterCents: a.BalanceCents,
		SourceType: strings.TrimSpace(sourceType), SourceID: strings.TrimSpace(sourceID),
		Description: strings.TrimSpace(description), CreatedAt: now,
	}, nil
}
