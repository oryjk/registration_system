package application

import (
	"context"
	"errors"
	"testing"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestListMemberTransactionsPermissions(t *testing.T) {
	authorizer := fakeTeamManagerAuthorizer{managers: map[int64]bool{42: true}}
	service := NewQueryService(&fakeFundRepository{}, authorizer)

	// 管理员与该队队长/领队可查；普通队员与未配置校验器时拒绝。
	if _, err := service.ListMemberTransactions(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin}, 3, 4, 0, 30); err != nil {
		t.Fatalf("admin must pass: %v", err)
	}
	if _, err := service.ListMemberTransactions(context.Background(), captainActor(42), 3, 4, 0, 30); err != nil {
		t.Fatalf("team manager must pass: %v", err)
	}
	if _, err := service.ListMemberTransactions(context.Background(), captainActor(9), 3, 4, 0, 30); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("regular member must be forbidden, got %v", err)
	}
	unauthorized := NewQueryService(&fakeFundRepository{}, nil)
	if _, err := unauthorized.ListMemberTransactions(context.Background(), captainActor(42), 3, 4, 0, 30); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("missing authorizer must forbid users, got %v", err)
	}
	if _, err := service.ListMemberTransactions(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin}, 0, 4, 0, 30); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("invalid ids must be rejected, got %v", err)
	}
}
