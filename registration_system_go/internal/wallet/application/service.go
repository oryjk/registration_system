package application

import (
	"context"
	"errors"
	"strings"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	walletdomain "github.com/oryjk/registration_system/registration_system_go/internal/wallet/domain"
	walletports "github.com/oryjk/registration_system/registration_system_go/internal/wallet/ports"
)

const (
	defaultPageSize = 20
	maxPageSize     = 100
)

type Service struct{ repository walletports.Repository }

func NewService(repository walletports.Repository) *Service { return &Service{repository: repository} }

func (s *Service) Get(ctx context.Context, actor sharedauth.Actor) (walletdomain.Account, error) {
	if !actor.IsUser() {
		return walletdomain.Account{}, sharederror.ErrForbidden
	}
	return s.getByUserID(ctx, actor.ID)
}

func (s *Service) GetForAdmin(ctx context.Context, actor sharedauth.Actor, userID int64) (walletdomain.Account, error) {
	if !actor.IsAdmin() {
		return walletdomain.Account{}, sharederror.ErrForbidden
	}
	if userID <= 0 {
		return walletdomain.Account{}, sharederror.ErrValidation
	}
	return s.getByUserID(ctx, userID)
}

func (s *Service) getByUserID(ctx context.Context, userID int64) (walletdomain.Account, error) {
	account, err := s.repository.GetAccount(ctx, userID)
	if errors.Is(err, sharederror.ErrNotFound) {
		return walletdomain.Account{UserID: userID}, nil
	}
	return account, err
}

type TransactionListQuery struct {
	Page     int
	PageSize int
}

type TransactionListResult struct {
	Items    []walletdomain.Transaction
	Total    int64
	Page     int
	PageSize int
}

func (s *Service) ListTransactions(ctx context.Context, actor sharedauth.Actor, query TransactionListQuery) (TransactionListResult, error) {
	if !actor.IsUser() {
		return TransactionListResult{}, sharederror.ErrForbidden
	}
	if query.Page < 1 {
		query.Page = 1
	}
	if query.PageSize < 1 {
		query.PageSize = defaultPageSize
	}
	if query.PageSize > maxPageSize {
		query.PageSize = maxPageSize
	}
	items, total, err := s.repository.ListTransactions(ctx, walletports.TransactionFilter{UserID: actor.ID, Limit: query.PageSize, Offset: (query.Page - 1) * query.PageSize})
	if err != nil {
		return TransactionListResult{}, err
	}
	return TransactionListResult{Items: items, Total: total, Page: query.Page, PageSize: query.PageSize}, nil
}

type DebitCommand struct {
	UserID      int64
	AmountCents int64
	SourceType  string
	SourceID    string
	Description string
}

func (s *Service) Debit(ctx context.Context, command DebitCommand) (walletdomain.Account, error) {
	if command.UserID <= 0 || command.AmountCents < 1 || strings.TrimSpace(command.SourceType) == "" || strings.TrimSpace(command.SourceID) == "" {
		return walletdomain.Account{}, sharederror.ErrValidation
	}
	account, err := s.repository.Debit(ctx, walletports.DebitRequest{
		UserID: command.UserID, AmountCents: command.AmountCents,
		SourceType: strings.TrimSpace(command.SourceType), SourceID: strings.TrimSpace(command.SourceID),
		Description: strings.TrimSpace(command.Description),
	})
	if errors.Is(err, walletdomain.ErrInsufficientBalance) {
		return walletdomain.Account{}, sharederror.New(sharederror.KindConflict, "余额不足")
	}
	return account, err
}
