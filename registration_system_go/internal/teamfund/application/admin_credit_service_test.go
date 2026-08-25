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

type fakeAdminCreditRepository struct {
	credits []teamfundports.AdminCredit
}

func (f *fakeAdminCreditRepository) AdminCredit(_ context.Context, credit teamfundports.AdminCredit) (teamfundports.AdminCreditResult, error) {
	if credit.AmountCents <= 0 {
		return teamfundports.AdminCreditResult{}, sharederror.New(sharederror.KindValidation, "充值金额需要大于 0")
	}
	f.credits = append(f.credits, credit)
	return teamfundports.AdminCreditResult{BalanceCents: credit.AmountCents, TransactionID: int64(len(f.credits))}, nil
}

func TestAdminCreditRequiresAdminActor(t *testing.T) {
	service := NewAdminCreditService(&fakeAdminCreditRepository{}, &fakeNotifications{})
	_, err := service.Credit(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 9},
		AdminCreditRequest{TeamID: 1, UserID: 2, AmountCents: 100})
	if !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("非管理员应返回 Forbidden，得到 %v", err)
	}
}

func TestAdminCreditRejectsNonPositiveAmount(t *testing.T) {
	service := NewAdminCreditService(&fakeAdminCreditRepository{}, &fakeNotifications{})
	_, err := service.Credit(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin},
		AdminCreditRequest{TeamID: 1, UserID: 2, AmountCents: 0})
	if !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("金额 0 应返回校验错误，得到 %v", err)
	}
}

func TestAdminCreditRejectsAmountAboveCap(t *testing.T) {
	service := NewAdminCreditService(&fakeAdminCreditRepository{}, &fakeNotifications{})
	_, err := service.Credit(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin},
		AdminCreditRequest{TeamID: 1, UserID: 2, AmountCents: 1_000_001})
	if !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("超过单笔上限应返回校验错误，得到 %v", err)
	}
}

func TestAdminCreditPassesThroughAndTrimsNote(t *testing.T) {
	repository := &fakeAdminCreditRepository{}
	service := NewAdminCreditService(repository, &fakeNotifications{})
	result, err := service.Credit(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin},
		AdminCreditRequest{TeamID: 3, UserID: 4, AmountCents: 2500, Note: "  线下现金 "})
	if err != nil {
		t.Fatal(err)
	}
	if result.BalanceCents != 2500 {
		t.Fatalf("应透传充值结果: %+v", result)
	}
	if len(repository.credits) != 1 || repository.credits[0].Note != "线下现金" {
		t.Fatalf("备注应去空白后透传: %+v", repository.credits)
	}
}

func TestAdminCreditNotifiesMember(t *testing.T) {
	notifications := &fakeNotifications{}
	service := NewAdminCreditService(&fakeAdminCreditRepository{}, notifications)
	_, err := service.Credit(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin},
		AdminCreditRequest{TeamID: 3, UserID: 4, AmountCents: 2500, Note: "线下现金"})
	if err != nil {
		t.Fatal(err)
	}
	if len(notifications.messages) != 1 {
		t.Fatalf("应发送一条到账通知: %+v", notifications.messages)
	}
	message := notifications.messages[0]
	if message.UserID != 4 || message.Kind != "teamfund_credited" || message.Title != "队费充值到账" {
		t.Fatalf("通知基础字段不符: %+v", message)
	}
	if !strings.Contains(message.Content, "+¥25.00") || !strings.Contains(message.Content, "¥25.00") || !strings.Contains(message.Content, "线下现金") {
		t.Fatalf("通知内容应含金额、余额与备注: %q", message.Content)
	}
}

func TestAdminCreditIgnoresNotificationFailure(t *testing.T) {
	service := NewAdminCreditService(&fakeAdminCreditRepository{}, &fakeNotifications{err: errors.New("boom")})
	if _, err := service.Credit(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin},
		AdminCreditRequest{TeamID: 3, UserID: 4, AmountCents: 2500}); err != nil {
		t.Fatalf("通知失败不应影响充值: %v", err)
	}
}
