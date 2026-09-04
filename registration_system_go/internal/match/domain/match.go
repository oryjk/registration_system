package domain

import (
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type PublicationMode string

const (
	OfflineConfirmed PublicationMode = "offline_confirmed"
	OnlineTeam       PublicationMode = "online_team"
	OnlineIndividual PublicationMode = "online_individual"
	// OnlinePickup 散人约球：所有参与者都是散人、没有球队概念；任何登录用户可发布。
	OnlinePickup PublicationMode = "online_pickup"
)

// PaymentMode 报名费用的支付节奏：赛后支付（默认）或赛前报名时支付。
type PaymentMode string

const (
	PaymentPostpaid PaymentMode = "postpaid"
	PaymentPrepaid  PaymentMode = "prepaid"
)

func (m PaymentMode) normalized() PaymentMode {
	if m == PaymentPrepaid {
		return PaymentPrepaid
	}
	return PaymentPostpaid
}

type OpponentState string

const (
	OpponentNoRecruitment OpponentState = "no_recruitment"
	OpponentRecruiting    OpponentState = "recruiting"
	OpponentConfirmed     OpponentState = "confirmed"
)

type MatchStatus string

const (
	MatchRegistering MatchStatus = "registering"
	MatchOngoing     MatchStatus = "ongoing"
	MatchEnded       MatchStatus = "ended"
	MatchCancelled   MatchStatus = "cancelled"
)

// maxMatchScore 单边比分上限，防止误录入天文数字。
const maxMatchScore = 999

type Match struct {
	ID              uuid.UUID
	Name            string
	PublicationMode PublicationMode
	OpponentState   OpponentState
	Status          MatchStatus
	HostTeamID      *int64
	AwayTeamID      *int64
	OpponentName    *string
	PlayersPerTeam  int
	// HostScore/AwayScore 比赛比分；nil 表示尚未录入。
	HostScore           *int
	AwayScore           *int
	StartTime           time.Time
	EndTime             time.Time
	RegistrationStartAt *time.Time
	RegistrationEndAt   *time.Time
	Location            string
	LocationLatitude    *float64
	LocationLongitude   *float64
	Description         *string
	HostColor           string
	AwayColor           string
	IsFree              bool
	// PaymentMode 报名费支付节奏；FeePerPersonCents 人均报名费（分），0 表示免费。
	PaymentMode       PaymentMode
	FeePerPersonCents int64
	CreatedByUserID   *int64
	CreatedByAdminID  *int64
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type NewMatchInput struct {
	Name            string
	PublicationMode PublicationMode
	// HostTeamID 为 nil 表示散人约球（online_pickup）这类无主队模式。
	HostTeamID          *int64
	CreatedByUserID     *int64
	CreatedByAdminID    *int64
	OpponentName        *string
	PlayersPerTeam      int
	HostCapacityLimit   *int
	StartTime           time.Time
	EndTime             time.Time
	RegistrationStartAt *time.Time
	RegistrationEndAt   *time.Time
	Location            string
	LocationLatitude    *float64
	LocationLongitude   *float64
	Description         *string
	HostColor           *string
	AwayColor           *string
	IsFree              *bool
	// PaymentMode/FeePerPersonCents 报名支付配置；PaymentMode 空串按赛后支付处理。
	PaymentMode       PaymentMode
	FeePerPersonCents int64
	CreatedAt         time.Time
}

type IndividualLimits struct {
	MinPlayers int
	MaxPlayers int
}

func NewMatch(input NewMatchInput, individualLimits IndividualLimits) (Match, []RegistrationGroup, error) {
	if err := validateNewMatchInput(input); err != nil {
		return Match{}, nil, err
	}
	now := input.CreatedAt
	if now.IsZero() {
		now = time.Now().UTC()
	}
	matchID := uuid.New()
	opponentState := OpponentRecruiting
	if input.PublicationMode == OfflineConfirmed {
		opponentState = OpponentNoRecruitment
	}
	hostColor, err := normalizeOptionalColor(input.HostColor)
	if err != nil {
		return Match{}, nil, err
	}
	awayColor, err := normalizeOptionalColor(input.AwayColor)
	if err != nil {
		return Match{}, nil, err
	}
	paymentMode := input.PaymentMode.normalized()
	if err := validatePaymentConfig(paymentMode, input.FeePerPersonCents); err != nil {
		return Match{}, nil, err
	}
	// 有人均报名费时强制视为收费比赛，避免 is_free 与费用互相矛盾。
	isFree := input.IsFree == nil || *input.IsFree
	if input.FeePerPersonCents > 0 {
		isFree = false
	}
	match := Match{
		ID:                  matchID,
		Name:                strings.TrimSpace(input.Name),
		PublicationMode:     input.PublicationMode,
		OpponentState:       opponentState,
		Status:              MatchRegistering,
		HostTeamID:          input.HostTeamID,
		OpponentName:        trimOptional(input.OpponentName),
		PlayersPerTeam:      input.PlayersPerTeam,
		StartTime:           input.StartTime,
		EndTime:             input.EndTime,
		RegistrationStartAt: input.RegistrationStartAt,
		RegistrationEndAt:   input.RegistrationEndAt,
		Location:            strings.TrimSpace(input.Location),
		LocationLatitude:    input.LocationLatitude,
		LocationLongitude:   input.LocationLongitude,
		Description:         trimOptional(input.Description),
		HostColor:           hostColor,
		AwayColor:           awayColor,
		IsFree:              isFree,
		PaymentMode:         paymentMode,
		FeePerPersonCents:   input.FeePerPersonCents,
		CreatedByUserID:     input.CreatedByUserID,
		CreatedByAdminID:    input.CreatedByAdminID,
		CreatedAt:           now,
		UpdatedAt:           now,
	}
	// 散人约球没有主队，全部报名进同一个散人组；其余模式先建主队组。
	var groups []RegistrationGroup
	if input.PublicationMode != OnlinePickup {
		groups = append(groups, NewTeamGroup(matchID, GroupHostTeam, derefTeamID(input.HostTeamID), input.HostCapacityLimit, now))
	}
	if input.PublicationMode == OnlineIndividual || input.PublicationMode == OnlinePickup {
		if err := individualLimits.Validate(); err != nil {
			return Match{}, nil, err
		}
		groups = append(groups, NewIndividualGroup(matchID, individualLimits, now))
	}
	return match, groups, nil
}

func derefTeamID(value *int64) int64 {
	if value == nil {
		return 0
	}
	return *value
}

func validatePaymentConfig(mode PaymentMode, feePerPersonCents int64) error {
	if mode != PaymentPostpaid && mode != PaymentPrepaid {
		return sharederror.New(sharederror.KindValidation, "报名支付方式无效")
	}
	if feePerPersonCents < 0 {
		return sharederror.New(sharederror.KindValidation, "人均报名费不能为负数")
	}
	if mode == PaymentPrepaid && feePerPersonCents <= 0 {
		return sharederror.New(sharederror.KindValidation, "赛前支付必须填写人均报名费")
	}
	return nil
}

func ResolveIndividualLimits(playersPerTeam int, configured *IndividualLimits) (IndividualLimits, error) {
	if playersPerTeam <= 0 {
		return IndividualLimits{}, sharederror.New(sharederror.KindValidation, "每队人数必须大于 0")
	}
	if configured != nil {
		if err := configured.Validate(); err != nil {
			return IndividualLimits{}, err
		}
		return *configured, nil
	}
	return IndividualLimits{MinPlayers: playersPerTeam, MaxPlayers: playersPerTeam + 2}, nil
}

func (l IndividualLimits) Validate() error {
	if l.MinPlayers <= 0 || l.MaxPlayers <= 0 || l.MinPlayers > l.MaxPlayers {
		return sharederror.New(sharederror.KindValidation, "散人报名人数规则无效")
	}
	return nil
}

func (m *Match) ConfirmTeamOpponent(awayTeamID int64, now time.Time) error {
	if m.Status != MatchRegistering || m.PublicationMode != OnlineTeam || m.OpponentState != OpponentRecruiting {
		return sharederror.New(sharederror.KindConflict, "当前比赛不能选择球队对手")
	}
	if awayTeamID <= 0 || (m.HostTeamID != nil && awayTeamID == *m.HostTeamID) {
		return sharederror.New(sharederror.KindValidation, "对手球队无效")
	}
	m.AwayTeamID = &awayTeamID
	m.OpponentState = OpponentConfirmed
	m.UpdatedAt = now
	return nil
}

func (m *Match) ReopenTeamRecruitment(now time.Time) error {
	if m.Status != MatchRegistering || m.PublicationMode != OnlineTeam || m.OpponentState != OpponentConfirmed || m.AwayTeamID == nil {
		return sharederror.New(sharederror.KindConflict, "当前比赛没有可退出的球队对手")
	}
	m.AwayTeamID = nil
	m.OpponentState = OpponentRecruiting
	m.UpdatedAt = now
	return nil
}

func (m *Match) RecalculateIndividualOpponent(activePlayers, minPlayers int, now time.Time) error {
	if m.PublicationMode != OnlineIndividual && m.PublicationMode != OnlinePickup {
		return sharederror.New(sharederror.KindConflict, "当前比赛不是散人报名模式")
	}
	if activePlayers < 0 || minPlayers <= 0 {
		return sharederror.New(sharederror.KindValidation, "散人报名人数规则无效")
	}
	nextState := OpponentRecruiting
	if activePlayers >= minPlayers {
		nextState = OpponentConfirmed
	}
	if m.OpponentState != nextState {
		m.OpponentState = nextState
		m.UpdatedAt = now
	}
	return nil
}

func (m Match) RegistrationOpenAt(now time.Time) bool {
	// 比赛结束时间已过即视为报名关闭：过期未收尾的比赛状态仍停在 registering，
	// 不能只依赖状态与报名窗口判断（否则赛后仍可增删报名）。
	if !m.EndTime.IsZero() && !now.Before(m.EndTime) {
		return false
	}
	if m.RegistrationStartAt != nil && now.Before(*m.RegistrationStartAt) {
		return false
	}
	return m.RegistrationEndAt == nil || now.Before(*m.RegistrationEndAt)
}

type UpdateMatchDetails struct {
	Name                string
	StartTime           time.Time
	EndTime             time.Time
	RegistrationStartAt *time.Time
	RegistrationEndAt   *time.Time
	Location            string
	LocationLatitude    *float64
	LocationLongitude   *float64
	// OpponentName 非 nil 时更新手工对手名称（传空串表示清除为 NULL）；
	// nil 表示本次编辑不改对手。仅对线下已约（offline_confirmed）比赛有意义。
	OpponentName *string
	// HostColor/AwayColor 非 nil 时更新球服颜色（空串清除为 NULL）；nil 表示不改。
	HostColor   *string
	AwayColor   *string
	Description *string
}

func (m *Match) UpdateDetails(input UpdateMatchDetails, now time.Time) error {
	if m.Status == MatchEnded || m.Status == MatchCancelled {
		return sharederror.New(sharederror.KindConflict, "已结束或已取消的比赛不能编辑")
	}
	opponentName := m.OpponentName
	if input.OpponentName != nil {
		opponentName = trimOptional(input.OpponentName)
	}
	hostColor := m.HostColor
	if input.HostColor != nil {
		if v, cerr := NormalizeJerseyColor(*input.HostColor); cerr != nil {
			return cerr
		} else {
			hostColor = v
		}
	}
	awayColor := m.AwayColor
	if input.AwayColor != nil {
		if v, cerr := NormalizeJerseyColor(*input.AwayColor); cerr != nil {
			return cerr
		} else {
			awayColor = v
		}
	}
	validation := NewMatchInput{
		Name: input.Name, PublicationMode: m.PublicationMode, HostTeamID: m.HostTeamID,
		CreatedByUserID: m.CreatedByUserID, CreatedByAdminID: m.CreatedByAdminID,
		OpponentName: opponentName, PlayersPerTeam: m.PlayersPerTeam,
		StartTime: input.StartTime, EndTime: input.EndTime,
		RegistrationStartAt: input.RegistrationStartAt, RegistrationEndAt: input.RegistrationEndAt,
		Location:         input.Location,
		LocationLatitude: input.LocationLatitude, LocationLongitude: input.LocationLongitude,
		PaymentMode: m.PaymentMode, FeePerPersonCents: m.FeePerPersonCents,
	}
	if err := validateNewMatchInput(validation); err != nil {
		return err
	}
	m.Name = strings.TrimSpace(input.Name)
	m.StartTime = input.StartTime
	m.EndTime = input.EndTime
	m.RegistrationStartAt = input.RegistrationStartAt
	m.RegistrationEndAt = input.RegistrationEndAt
	m.Location = strings.TrimSpace(input.Location)
	m.LocationLatitude = input.LocationLatitude
	m.LocationLongitude = input.LocationLongitude
	m.Description = trimOptional(input.Description)
	m.OpponentName = opponentName
	m.HostColor = hostColor
	m.AwayColor = awayColor
	m.UpdatedAt = now
	return nil
}

// FinishByHost 主队管理方收尾比赛：标记正常结束或取消。
// 与管理端通用的 ChangeStatus 不同，这里不依赖 ongoing 中间态——
// 过期仍停留在 registering 的比赛允许直接收尾。
// 取消不受时间限制（创建者赛前临时取消）；标记已结束仍必须过结束时间。
func (m *Match) FinishByHost(next MatchStatus, now time.Time) error {
	if next != MatchEnded && next != MatchCancelled {
		return sharederror.New(sharederror.KindValidation, "收尾状态只能是已结束或已取消")
	}
	if m.Status == next {
		return nil
	}
	if m.Status == MatchEnded || m.Status == MatchCancelled {
		return sharederror.New(sharederror.KindConflict, "比赛已结束或已取消，不能再次变更")
	}
	if next == MatchEnded && !now.After(m.EndTime) {
		return sharederror.New(sharederror.KindConflict, "比赛尚未到结束时间，暂不能收尾")
	}
	m.Status = next
	m.UpdatedAt = now
	return nil
}

func (m *Match) ChangeStatus(next MatchStatus, now time.Time) error {
	if m.Status == next {
		return nil
	}
	allowed := false
	switch m.Status {
	case MatchRegistering:
		allowed = next == MatchOngoing || next == MatchCancelled
	case MatchOngoing:
		allowed = next == MatchEnded || next == MatchCancelled
	}
	if !allowed {
		return sharederror.New(sharederror.KindConflict, "比赛状态不能这样变更")
	}
	m.Status = next
	m.UpdatedAt = now
	return nil
}

// RecordScore 录入/修改比赛比分：仅比赛进行中或已结束允许，
// 报名期与已取消的比赛不能录入。比分可反复修正（例如赛后补录、改错）。
func (m *Match) RecordScore(hostScore, awayScore int, now time.Time) error {
	if m.Status != MatchOngoing && m.Status != MatchEnded {
		return sharederror.New(sharederror.KindConflict, "比赛开始后才能录入比分")
	}
	if hostScore < 0 || awayScore < 0 || hostScore > maxMatchScore || awayScore > maxMatchScore {
		return sharederror.New(sharederror.KindValidation, "比分必须在 0 到 999 之间")
	}
	m.HostScore = &hostScore
	m.AwayScore = &awayScore
	m.UpdatedAt = now
	return nil
}

func validateNewMatchInput(input NewMatchInput) error {
	if strings.TrimSpace(input.Name) == "" {
		return sharederror.New(sharederror.KindValidation, "比赛名称不能为空")
	}
	if strings.TrimSpace(input.Location) == "" {
		return sharederror.New(sharederror.KindValidation, "比赛场地不能为空")
	}
	// 散人约球没有主队；其余模式必须有发布球队。
	if input.PublicationMode == OnlinePickup {
		if input.HostTeamID != nil {
			return sharederror.New(sharederror.KindValidation, "散人约球不能以球队名义发布")
		}
	} else if input.HostTeamID == nil || *input.HostTeamID <= 0 {
		return sharederror.New(sharederror.KindValidation, "发布球队无效")
	}
	userCreator := input.CreatedByUserID != nil && *input.CreatedByUserID > 0
	adminCreator := input.CreatedByAdminID != nil && *input.CreatedByAdminID > 0
	if userCreator == adminCreator {
		return sharederror.New(sharederror.KindValidation, "比赛创建者无效")
	}
	if input.PlayersPerTeam <= 0 {
		return sharederror.New(sharederror.KindValidation, "每队人数必须大于 0")
	}
	if input.EndTime.IsZero() || !input.EndTime.After(input.StartTime) {
		return sharederror.New(sharederror.KindValidation, "结束时间必须晚于开始时间")
	}
	if input.RegistrationStartAt != nil && input.RegistrationEndAt != nil && !input.RegistrationEndAt.After(*input.RegistrationStartAt) {
		return sharederror.New(sharederror.KindValidation, "报名结束时间必须晚于报名开始时间")
	}
	if input.HostCapacityLimit != nil && *input.HostCapacityLimit <= 0 {
		return sharederror.New(sharederror.KindValidation, "本队报名上限必须大于 0")
	}
	if (input.LocationLatitude == nil) != (input.LocationLongitude == nil) {
		return sharederror.New(sharederror.KindValidation, "场地经纬度必须同时提供")
	}
	if input.LocationLatitude != nil && (*input.LocationLatitude < -90 || *input.LocationLatitude > 90 || *input.LocationLongitude < -180 || *input.LocationLongitude > 180) {
		return sharederror.New(sharederror.KindValidation, "场地经纬度超出范围")
	}
	for _, color := range []*string{input.HostColor, input.AwayColor} {
		if color == nil {
			continue
		}
		if _, err := NormalizeJerseyColor(*color); err != nil {
			return err
		}
	}
	opponentName := trimOptional(input.OpponentName)
	switch input.PublicationMode {
	case OfflineConfirmed:
		if opponentName == nil {
			return sharederror.New(sharederror.KindValidation, "线下已约比赛必须填写对手名称")
		}
	case OnlineTeam, OnlineIndividual, OnlinePickup:
		if opponentName != nil {
			return sharederror.New(sharederror.KindValidation, "线上发布不能填写手工对手名称")
		}
	default:
		return sharederror.New(sharederror.KindValidation, "比赛发布模式无效")
	}
	if err := validatePaymentConfig(input.PaymentMode.normalized(), input.FeePerPersonCents); err != nil {
		return err
	}
	return nil
}

func trimOptional(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

var jerseyColorPattern = regexp.MustCompile(`^#[0-9a-f]{6}$`)

// NormalizeJerseyColor 校验并归一化球服颜色；空串原样返回（表示清除/未设置）。
func NormalizeJerseyColor(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", nil
	}
	lower := strings.ToLower(trimmed)
	if !jerseyColorPattern.MatchString(lower) {
		return "", sharederror.New(sharederror.KindValidation, "球服颜色必须是 #RRGGBB 格式")
	}
	return lower, nil
}

func normalizeOptionalColor(value *string) (string, error) {
	if value == nil {
		return "", nil
	}
	return NormalizeJerseyColor(*value)
}
