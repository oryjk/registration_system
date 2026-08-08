package application

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestTeamApplicationFlowSelectsOneTeamAtomically(t *testing.T) {
	matchID := uuid.New()
	match := teamRecruitingMatch(matchID)
	first, _ := domain.NewTeamApplication(matchID, 8, 81, "阵容齐整", fixedClock().Now())
	second, _ := domain.NewTeamApplication(matchID, 9, 91, "可以准时到场", fixedClock().Now())
	repository := newFakeTeamApplicationRepository(match, first, second)
	access := &fakeApplicationTeamAccess{managers: map[int64]map[int64]bool{7: {71: true}, 8: {81: true}, 9: {91: true}}}
	service := NewTeamApplicationService(repository, access, fixedClock())

	selected, err := service.Select(context.Background(), userActor(71), matchID, second.ID)
	if err != nil {
		t.Fatalf("select team application: %v", err)
	}
	if selected.Status != domain.ApplicationSelected || repository.match.OpponentState != domain.OpponentConfirmed {
		t.Fatalf("unexpected selected result: application=%+v match=%+v", selected, repository.match)
	}
	if repository.match.AwayTeamID == nil || *repository.match.AwayTeamID != second.ApplicantTeamID {
		t.Fatalf("unexpected away team: %+v", repository.match.AwayTeamID)
	}
	if repository.applications[first.ID].Status != domain.ApplicationRejected {
		t.Fatalf("other pending application was not rejected: %+v", repository.applications[first.ID])
	}
	if repository.guestGroup == nil || repository.guestGroup.Kind != domain.GroupGuestTeam || *repository.guestGroup.TeamID != second.ApplicantTeamID {
		t.Fatalf("guest registration group was not created: %+v", repository.guestGroup)
	}
	if repository.transactions != 1 {
		t.Fatalf("expected one transaction, got %d", repository.transactions)
	}
}

func TestTeamApplicationFlowReopensAfterSelectedTeamWithdraws(t *testing.T) {
	matchID := uuid.New()
	match := teamRecruitingMatch(matchID)
	awayTeamID := int64(8)
	match.AwayTeamID = &awayTeamID
	match.OpponentState = domain.OpponentConfirmed
	application, _ := domain.NewTeamApplication(matchID, awayTeamID, 81, "申请参赛", fixedClock().Now())
	_ = application.Select(fixedClock().Now())
	guestGroup := domain.NewTeamGroup(matchID, domain.GroupGuestTeam, awayTeamID, nil, fixedClock().Now())
	repository := newFakeTeamApplicationRepository(match, application)
	repository.guestGroup = &guestGroup
	access := &fakeApplicationTeamAccess{managers: map[int64]map[int64]bool{7: {71: true}, 8: {81: true}}}
	service := NewTeamApplicationService(repository, access, fixedClock())

	withdrawn, err := service.Withdraw(context.Background(), userActor(81), matchID, application.ID)
	if err != nil {
		t.Fatalf("withdraw selected team: %v", err)
	}
	if withdrawn.Status != domain.ApplicationWithdrawn || repository.match.AwayTeamID != nil || repository.match.OpponentState != domain.OpponentRecruiting {
		t.Fatalf("match was not reopened: application=%+v match=%+v", withdrawn, repository.match)
	}
	if repository.guestGroup.Status != domain.GroupCancelled || repository.guestGroup.CancelledAt == nil {
		t.Fatalf("guest group was not cancelled: %+v", repository.guestGroup)
	}
}

func TestTeamApplicationRequiresActiveCandidateManager(t *testing.T) {
	match := teamRecruitingMatch(uuid.New())
	repository := newFakeTeamApplicationRepository(match)
	access := &fakeApplicationTeamAccess{managers: map[int64]map[int64]bool{8: {82: false}}}
	service := NewTeamApplicationService(repository, access, fixedClock())

	_, err := service.Apply(context.Background(), userActor(82), match.ID, 8, "申请参赛")
	if !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden for ordinary member, got %v", err)
	}
	if len(repository.applications) != 0 {
		t.Fatal("forbidden application must not be persisted")
	}
}

func TestTeamApplicationRejectsClosedMatch(t *testing.T) {
	match := teamRecruitingMatch(uuid.New())
	match.Status = domain.MatchOngoing
	repository := newFakeTeamApplicationRepository(match)
	access := &fakeApplicationTeamAccess{managers: map[int64]map[int64]bool{8: {81: true}}}
	service := NewTeamApplicationService(repository, access, fixedClock())

	_, err := service.Apply(context.Background(), userActor(81), match.ID, 8, "申请参赛")
	if !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("expected conflict for ongoing match, got %v", err)
	}
}

func teamRecruitingMatch(id uuid.UUID) domain.Match {
	return domain.Match{
		ID: id, PublicationMode: domain.OnlineTeam, OpponentState: domain.OpponentRecruiting,
		Status: domain.MatchRegistering, HostTeamID: 7, PlayersPerTeam: 8,
	}
}

type fakeTeamApplicationRepository struct {
	match        domain.Match
	applications map[uuid.UUID]domain.TeamApplication
	guestGroup   *domain.RegistrationGroup
	transactions int
}

func newFakeTeamApplicationRepository(match domain.Match, applications ...domain.TeamApplication) *fakeTeamApplicationRepository {
	items := make(map[uuid.UUID]domain.TeamApplication, len(applications))
	for _, application := range applications {
		items[application.ID] = application
	}
	return &fakeTeamApplicationRepository{match: match, applications: items}
}

func (f *fakeTeamApplicationRepository) FindMatch(context.Context, uuid.UUID) (domain.Match, bool, error) {
	return f.match, f.match.ID != uuid.Nil, nil
}

func (f *fakeTeamApplicationRepository) ListApplications(context.Context, uuid.UUID) ([]ports.TeamApplicationItem, error) {
	items := make([]ports.TeamApplicationItem, 0, len(f.applications))
	for _, application := range f.applications {
		items = append(items, ports.TeamApplicationItem{Application: application})
	}
	return items, nil
}

func (f *fakeTeamApplicationRepository) ListApplicationsForManager(_ context.Context, _ uuid.UUID, userID int64) ([]ports.TeamApplicationItem, error) {
	items := make([]ports.TeamApplicationItem, 0)
	for _, application := range f.applications {
		if application.CreatedByUserID == userID {
			items = append(items, ports.TeamApplicationItem{Application: application})
		}
	}
	return items, nil
}

func (f *fakeTeamApplicationRepository) WithinTeamApplicationTransaction(ctx context.Context, operation func(ports.TeamApplicationTransaction) error) error {
	f.transactions++
	return operation(f)
}

func (f *fakeTeamApplicationRepository) FindApplication(_ context.Context, matchID, applicationID uuid.UUID) (domain.TeamApplication, bool, error) {
	application, found := f.applications[applicationID]
	return application, found && application.MatchID == matchID, nil
}

func (f *fakeTeamApplicationRepository) ListPendingApplications(context.Context, uuid.UUID) ([]domain.TeamApplication, error) {
	items := make([]domain.TeamApplication, 0)
	for _, application := range f.applications {
		if application.Status == domain.ApplicationPending {
			items = append(items, application)
		}
	}
	return items, nil
}

func (f *fakeTeamApplicationRepository) FindActiveGuestGroup(context.Context, uuid.UUID) (domain.RegistrationGroup, bool, error) {
	if f.guestGroup == nil || f.guestGroup.Status == domain.GroupCancelled {
		return domain.RegistrationGroup{}, false, nil
	}
	return *f.guestGroup, true, nil
}

func (f *fakeTeamApplicationRepository) CreateApplication(_ context.Context, application domain.TeamApplication) error {
	f.applications[application.ID] = application
	return nil
}

func (f *fakeTeamApplicationRepository) UpdateApplication(_ context.Context, application domain.TeamApplication) error {
	f.applications[application.ID] = application
	return nil
}

func (f *fakeTeamApplicationRepository) CreateGroup(_ context.Context, group domain.RegistrationGroup) error {
	f.guestGroup = &group
	return nil
}

func (f *fakeTeamApplicationRepository) UpdateMatchOpponent(_ context.Context, match domain.Match) error {
	f.match = match
	return nil
}

func (f *fakeTeamApplicationRepository) UpdateGroup(_ context.Context, group domain.RegistrationGroup) error {
	f.guestGroup = &group
	return nil
}

type fakeApplicationTeamAccess struct {
	managers map[int64]map[int64]bool
	frozen   map[int64]bool
}

func (f *fakeApplicationTeamAccess) EnsureManager(_ context.Context, teamID, userID int64) error {
	if !f.managers[teamID][userID] {
		return sharederror.ErrForbidden
	}
	return nil
}

func (f *fakeApplicationTeamAccess) EnsureExists(context.Context, int64) error { return nil }

func (f *fakeApplicationTeamAccess) EnsureActive(_ context.Context, teamID int64) error {
	if f.frozen[teamID] {
		return sharederror.New(sharederror.KindConflict, "球队已冻结")
	}
	return nil
}

func (f *fakeApplicationTeamAccess) EnsureActiveMember(_ context.Context, teamID, userID int64) error {
	return f.EnsureManager(context.Background(), teamID, userID)
}

func (f *fakeApplicationTeamAccess) IsActiveMember(_ context.Context, teamID, userID int64) (bool, error) {
	return f.managers[teamID][userID], nil
}

var _ ports.TeamApplicationRepository = (*fakeTeamApplicationRepository)(nil)
var _ ports.TeamApplicationTransaction = (*fakeTeamApplicationRepository)(nil)
var _ ports.TeamAccess = (*fakeApplicationTeamAccess)(nil)
