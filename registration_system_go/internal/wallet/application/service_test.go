package application

import (
	"context"
	"errors"
	"testing"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	walletdomain "github.com/oryjk/registration_system/registration_system_go/internal/wallet/domain"
	walletports "github.com/oryjk/registration_system/registration_system_go/internal/wallet/ports"
)

func TestGetReturnsZeroWalletForUserWithoutAccount(t *testing.T) {
	repository := &fakeWalletRepository{getErr: sharederror.ErrNotFound}
	service := NewService(repository)
	account, err := service.Get(context.Background(), walletUser(37))
	if err != nil {
		t.Fatal(err)
	}
	if account.UserID != 37 || account.BalanceCents != 0 {
		t.Fatalf("account=%+v", account)
	}
}

func TestGetRejectsAdminActor(t *testing.T) {
	service := NewService(&fakeWalletRepository{})
	if _, err := service.Get(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("Get() error=%v", err)
	}
}

func TestDebitMapsInsufficientBalanceToConflict(t *testing.T) {
	repository := &fakeWalletRepository{debitErr: walletdomain.ErrInsufficientBalance}
	service := NewService(repository)
	_, err := service.Debit(context.Background(), DebitCommand{UserID: 37, AmountCents: 100, SourceType: "registration", SourceID: "match-1"})
	if !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("Debit() error=%v, want conflict", err)
	}
}

type fakeWalletRepository struct {
	account  walletdomain.Account
	getErr   error
	debitErr error
}

func (f *fakeWalletRepository) GetAccount(context.Context, int64) (walletdomain.Account, error) {
	return f.account, f.getErr
}

func (f *fakeWalletRepository) ListTransactions(context.Context, walletports.TransactionFilter) ([]walletdomain.Transaction, int64, error) {
	return nil, 0, nil
}

func (f *fakeWalletRepository) Debit(context.Context, walletports.DebitRequest) (walletdomain.Account, error) {
	return f.account, f.debitErr
}

func walletUser(id int64) sharedauth.Actor {
	return sharedauth.Actor{Kind: sharedauth.ActorUser, ID: id}
}
