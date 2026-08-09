package postgres

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
	walletdomain "github.com/oryjk/registration_system/registration_system_go/internal/wallet/domain"
	walletports "github.com/oryjk/registration_system/registration_system_go/internal/wallet/ports"
)

func TestRepositoryDebitsOnceForSameSource(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	ctx := context.Background()
	userID := seedWalletAccount(t, pool, 100)
	repository := NewRepository(pool)
	request := walletports.DebitRequest{UserID: userID, AmountCents: 40, SourceType: "registration", SourceID: fmt.Sprintf("match-%d", time.Now().UnixNano()), Description: "报名扣费"}

	first, err := repository.Debit(ctx, request)
	if err != nil {
		t.Fatal(err)
	}
	second, err := repository.Debit(ctx, request)
	if err != nil {
		t.Fatal(err)
	}
	if first.BalanceCents != 60 || second.BalanceCents != 60 || second.TotalSpentCents != 40 {
		t.Fatalf("first=%+v second=%+v", first, second)
	}
}

func TestRepositoryRejectsDebitAboveBalance(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	userID := seedWalletAccount(t, pool, 100)
	repository := NewRepository(pool)
	_, err := repository.Debit(context.Background(), walletports.DebitRequest{UserID: userID, AmountCents: 101, SourceType: "registration", SourceID: "too-much"})
	if !errors.Is(err, walletdomain.ErrInsufficientBalance) {
		t.Fatalf("Debit() error=%v", err)
	}
}

func seedWalletAccount(t *testing.T, pool *pgxpool.Pool, balance int64) int64 {
	t.Helper()
	ctx := context.Background()
	var userID int64
	openid := fmt.Sprintf("wallet-%d", time.Now().UnixNano())
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ($1) RETURNING id`, openid).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO wallet_accounts (user_id,balance_cents,total_recharged_cents) VALUES ($1,$2,$2)`, userID, balance); err != nil {
		t.Fatal(err)
	}
	return userID
}
