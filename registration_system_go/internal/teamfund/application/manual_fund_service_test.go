package application

import (
	"context"
	"errors"
	"strings"
	"testing"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	teamfundports "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/ports"
)

type fakeManualFundRepository struct {
	recharges []teamfundports.ManualFundAction
	consumes  []teamfundports.ManualFundAction
	reversals []teamfundports.ManualFundAction
	err       error
}

func (f *fakeManualFundRepository) ManualRecharge(_ context.Context, action teamfundports.ManualFundAction) (teamfundports.ManualFundResult, error) {
	if f.err != nil {
		return teamfundports.ManualFundResult{}, f.err
	}
	f.recharges = append(f.recharges, action)
	return teamfundports.ManualFundResult{BalanceCents: action.AmountCents, TransactionID: int64(len(f.recharges))}, nil
}

func (f *fakeManualFundRepository) ManualConsume(_ context.Context, action teamfundports.ManualFundAction) (teamfundports.ManualFundResult, error) {
	if f.err != nil {
		return teamfundports.ManualFundResult{}, f.err
	}
	f.consumes = append(f.consumes, action)
	return teamfundports.ManualFundResult{BalanceCents: -action.AmountCents, TransactionID: int64(len(f.consumes))}, nil
}

func (f *fakeManualFundRepository) ManualReverse(_ context.Context, action teamfundports.ManualFundAction) (teamfundports.ManualFundResult, error) {
	if f.err != nil {
		return teamfundports.ManualFundResult{}, f.err
	}
	f.reversals = append(f.reversals, action)
	return teamfundports.ManualFundResult{TransactionID: int64(len(f.reversals))}, nil
}

type fakeTeamManagerAuthorizer struct {
	managers map[int64]bool
}

func (f fakeTeamManagerAuthorizer) AuthorizeTeamManager(_ context.Context, actor sharedauth.Actor, _ int64) error {
	if actor.IsAdmin() || f.managers[actor.ID] {
		return nil
	}
	return sharederror.ErrForbidden
}

func captainActor(id int64) sharedauth.Actor {
	return sharedauth.Actor{Kind: sharedauth.ActorUser, ID: id}
}

func TestManualFundPermissions(t *testing.T) {
	authorizer := fakeTeamManagerAuthorizer{managers: map[int64]bool{42: true}}
	service := NewManualFundService(&fakeManualFundRepository{}, authorizer, &fakeNotifications{})
	request := ManualFundRequest{TeamID: 3, UserID: 4, AmountCents: 100, Note: "n"}

	// 普通队员不能替别人记账。
	if _, err := service.Recharge(context.Background(), captainActor(9), request); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("普通队员充值应被拒绝, got %v", err)
	}
	if _, err := service.Consume(context.Background(), captainActor(9), request); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("普通队员消费应被拒绝, got %v", err)
	}
	if _, err := service.Reverse(context.Background(), captainActor(9), request); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("普通队员冲正应被拒绝, got %v", err)
	}

	// 队长/领队与管理员均可记账，操作人取自认证身份。
	repository := &fakeManualFundRepository{}
	managed := NewManualFundService(repository, authorizer, &fakeNotifications{})
	if _, err := managed.Recharge(context.Background(), captainActor(42), request); err != nil {
		t.Fatalf("队长充值应放行: %v", err)
	}
	if _, err := managed.Consume(context.Background(), captainActor(42), request); err != nil {
		t.Fatalf("队长消费应放行: %v", err)
	}
	if len(repository.recharges) != 1 || repository.recharges[0].OperatorUserID != 42 {
		t.Fatalf("充值应记录操作人: %+v", repository.recharges)
	}
	if _, err := managed.Consume(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, request); err != nil {
		t.Fatalf("管理员消费应放行: %v", err)
	}

	// 未配置 authorizer 时普通用户一律拒绝（管理员不受影响）。
	nilAuth := NewManualFundService(repository, nil, &fakeNotifications{})
	if _, err := nilAuth.Recharge(context.Background(), captainActor(42), request); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("无 authorizer 时用户应被拒绝, got %v", err)
	}
}

func TestManualFundValidation(t *testing.T) {
	service := NewManualFundService(&fakeManualFundRepository{}, fakeTeamManagerAuthorizer{}, &fakeNotifications{})
	admin := sharedauth.Actor{Kind: sharedauth.ActorAdmin}

	cases := []struct {
		name string
		call func() error
	}{
		{"充值金额为 0", func() error {
			_, err := service.Recharge(context.Background(), admin, ManualFundRequest{TeamID: 1, UserID: 2, AmountCents: 0})
			return err
		}},
		{"充值金额为负", func() error {
			_, err := service.Recharge(context.Background(), admin, ManualFundRequest{TeamID: 1, UserID: 2, AmountCents: -100})
			return err
		}},
		{"充值超过上限", func() error {
			_, err := service.Recharge(context.Background(), admin, ManualFundRequest{TeamID: 1, UserID: 2, AmountCents: 1_000_001})
			return err
		}},
		{"消费超过上限", func() error {
			_, err := service.Consume(context.Background(), admin, ManualFundRequest{TeamID: 1, UserID: 2, AmountCents: 1_000_001, Note: "x"})
			return err
		}},
		{"消费缺少原因", func() error {
			_, err := service.Consume(context.Background(), admin, ManualFundRequest{TeamID: 1, UserID: 2, AmountCents: 100, Note: "  "})
			return err
		}},
		{"冲正缺少原因", func() error {
			_, err := service.Reverse(context.Background(), admin, ManualFundRequest{TeamID: 1, UserID: 2, OriginalTransactionID: 5, Note: " "})
			return err
		}},
		{"冲正缺少原流水", func() error {
			_, err := service.Reverse(context.Background(), admin, ManualFundRequest{TeamID: 1, UserID: 2, Note: "记错"})
			return err
		}},
		{"备注超长", func() error {
			_, err := service.Recharge(context.Background(), admin, ManualFundRequest{TeamID: 1, UserID: 2, AmountCents: 100, Note: strings.Repeat("长", 121)})
			return err
		}},
		{"幂等键超长", func() error {
			_, err := service.Recharge(context.Background(), admin, ManualFundRequest{TeamID: 1, UserID: 2, AmountCents: 100, IdempotencyKey: strings.Repeat("k", 65)})
			return err
		}},
	}
	for _, testCase := range cases {
		if err := testCase.call(); !errors.Is(err, sharederror.ErrValidation) {
			t.Fatalf("%s 应返回校验错误, got %v", testCase.name, err)
		}
	}
}

func TestManualFundMapsIdempotencyConflict(t *testing.T) {
	repository := &fakeManualFundRepository{err: teamfundports.ErrIdempotencyConflict}
	service := NewManualFundService(repository, fakeTeamManagerAuthorizer{}, &fakeNotifications{})
	admin := sharedauth.Actor{Kind: sharedauth.ActorAdmin}

	if _, err := service.Recharge(context.Background(), admin, ManualFundRequest{TeamID: 1, UserID: 2, AmountCents: 100}); !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("同键不同金额应返回 409, got %v", err)
	}
	if _, err := service.Consume(context.Background(), admin, ManualFundRequest{TeamID: 1, UserID: 2, AmountCents: 100, Note: "x"}); !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("同键不同金额应返回 409, got %v", err)
	}
}

func TestManualFundNotifications(t *testing.T) {
	notifications := &fakeNotifications{}
	repository := &fakeManualFundRepository{}
	service := NewManualFundService(repository, fakeTeamManagerAuthorizer{}, notifications)
	admin := sharedauth.Actor{Kind: sharedauth.ActorAdmin}

	if _, err := service.Recharge(context.Background(), admin, ManualFundRequest{TeamID: 3, UserID: 4, AmountCents: 2500, Note: "线下现金"}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Consume(context.Background(), admin, ManualFundRequest{TeamID: 3, UserID: 4, AmountCents: 800, Note: "队服"}); err != nil {
		t.Fatal(err)
	}
	if len(notifications.messages) != 2 {
		t.Fatalf("充值与消费各应通知一次: %+v", notifications.messages)
	}
	credited, consumed := notifications.messages[0], notifications.messages[1]
	if credited.UserID != 4 || credited.Kind != kindTeamFundCredited || !strings.Contains(credited.Content, "+¥25.00") {
		t.Fatalf("充值通知不符: %+v", credited)
	}
	if consumed.Kind != kindTeamFundConsumed || !strings.Contains(consumed.Content, "-¥8.00") || !strings.Contains(consumed.Content, "队服") {
		t.Fatalf("消费通知应含金额与原因: %+v", consumed)
	}

	// 幂等重放不重复通知。
	failing := &fakeNotifications{err: errors.New("boom")}
	replayService := NewManualFundService(&fakeManualFundRepository{}, fakeTeamManagerAuthorizer{}, failing)
	if _, err := replayService.Recharge(context.Background(), admin, ManualFundRequest{TeamID: 3, UserID: 4, AmountCents: 100}); err != nil {
		t.Fatal(err)
	}
	// fake 仓库不返回 Duplicated；直接验证通知失败不影响动作成功。
	if len(failing.messages) != 1 {
		t.Fatalf("通知失败不应影响记账: %+v", failing.messages)
	}
}
