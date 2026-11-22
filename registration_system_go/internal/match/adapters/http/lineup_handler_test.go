package matchhttp

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type fakeLineupService struct {
	actor          sharedauth.Actor
	getView        application.LineupView
	getFound       bool
	getErr         error
	saveView       application.LineupView
	saveErr        error
	savedFormation string
	savedSlots     []domain.LineupSlot
	saveCalls      int
	miniCodeURL    string
	miniCodeEnv    string
	miniCodeErr    error
	miniCodeCalls  int
}

func (f *fakeLineupService) Get(_ context.Context, actor sharedauth.Actor, _ uuid.UUID) (application.LineupView, bool, error) {
	f.actor = actor
	return f.getView, f.getFound, f.getErr
}

func (f *fakeLineupService) Save(_ context.Context, actor sharedauth.Actor, _ uuid.UUID, formation string, slots []domain.LineupSlot) (application.LineupView, error) {
	f.actor = actor
	f.saveCalls++
	f.savedFormation = formation
	f.savedSlots = slots
	return f.saveView, f.saveErr
}

func (f *fakeLineupService) GenerateMiniCode(_ context.Context, actor sharedauth.Actor, _ uuid.UUID, env string) (string, error) {
	f.actor = actor
	f.miniCodeCalls++
	f.miniCodeEnv = env
	return f.miniCodeURL, f.miniCodeErr
}

func newLineupTestRouter(service LineupUseCase) *gin.Engine {
	gin.SetMode(gin.TestMode)
	handler := NewLineupHandler(service)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeUserTokens{}).RequireUser())
	handler.RegisterRoutes(group)
	return router
}

func lineupRequest(router *gin.Engine, method, path, body string) *httptest.ResponseRecorder {
	var reader *bytes.Reader
	if body == "" {
		reader = bytes.NewReader(nil)
	} else {
		reader = bytes.NewReader([]byte(body))
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Authorization", "Bearer user-token")
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func TestLineupHandlerGetSaveAndMiniCode(t *testing.T) {
	matchID := uuid.New()
	editorID := int64(42)
	starterID := int64(10)
	avatar := "https://cdn.example.com/u10.png"
	updatedAt := time.Date(2026, 11, 22, 12, 0, 0, 0, time.UTC)

	view := application.LineupView{
		Lineup: domain.MatchLineup{
			MatchID:         matchID,
			PlayersPerTeam:  5,
			Formation:       "1-2-1",
			UpdatedByUserID: &editorID,
			UpdatedAt:       updatedAt,
			Slots: []domain.LineupSlot{
				{Slot: 0, PlayerID: &starterID, X: 0.5, Y: 0.9, SubPlayerIDs: []int64{20}},
				{Slot: 1, PlayerID: nil, X: 0.5, Y: 0.7, SubPlayerIDs: nil},
			},
		},
		Players: []ports.LineupPlayer{
			{UserID: 10, Nickname: "门将", AvatarURL: &avatar},
			{UserID: 20, Nickname: "替补"},
		},
	}

	service := &fakeLineupService{
		getFound:    false,
		saveView:    view,
		miniCodeURL: "https://cdn.example.com/lineup-code.png",
	}
	router := newLineupTestRouter(service)

	// 1. 未保存时返回 {"lineup": null}
	emptyResp := lineupRequest(router, http.MethodGet, "/matches/"+matchID.String()+"/lineup", "")
	if emptyResp.Code != http.StatusOK || !bytes.Contains(emptyResp.Body.Bytes(), []byte(`"lineup":null`)) {
		t.Fatalf("未保存阵型应返回 lineup:null, got %d: %s", emptyResp.Code, emptyResp.Body.String())
	}

	// 2. 已保存时返回完整 lineup（含 players 和非 null 的 sub_player_ids）
	service.getFound = true
	service.getView = view
	getResp := lineupRequest(router, http.MethodGet, "/matches/"+matchID.String()+"/lineup", "")
	if getResp.Code != http.StatusOK {
		t.Fatalf("GET lineup 失败 %d: %s", getResp.Code, getResp.Body.String())
	}
	var envelope struct {
		Code int                 `json:"code"`
		Data MatchLineupEnvelope `json:"data"`
	}
	if err := json.Unmarshal(getResp.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("解析响应失败: %v", err)
	}
	if envelope.Code != 0 || envelope.Data.Lineup == nil || envelope.Data.Lineup.Formation != "1-2-1" || len(envelope.Data.Lineup.Players) != 2 {
		t.Fatalf("GET lineup 数据不符: %+v", envelope)
	}
	if envelope.Data.Lineup.Slots[1].SubPlayerIDs == nil {
		t.Fatalf("sub_player_ids 序列化后不应为 null: %s", getResp.Body.String())
	}

	// 3. PUT 保存
	saveBody := `{"formation":"1-2-1","slots":[{"slot":0,"player_id":10,"x":0.5,"y":0.9,"sub_player_ids":[20]}]}`
	putResp := lineupRequest(router, http.MethodPut, "/matches/"+matchID.String()+"/lineup", saveBody)
	if putResp.Code != http.StatusOK || service.saveCalls != 1 || service.savedFormation != "1-2-1" || len(service.savedSlots) != 1 {
		t.Fatalf("PUT lineup 异常 %d calls=%d body=%s", putResp.Code, service.saveCalls, putResp.Body.String())
	}

	// 4. GET mini-code（显式 env 和默认 env）
	codeResp := lineupRequest(router, http.MethodGet, "/matches/"+matchID.String()+"/lineup/mini-code?env=trial", "")
	if codeResp.Code != http.StatusOK || service.miniCodeEnv != "trial" || !bytes.Contains(codeResp.Body.Bytes(), []byte(`"image_url":"https://cdn.example.com/lineup-code.png"`)) {
		t.Fatalf("mini-code 响应异常 %d env=%q body=%s", codeResp.Code, service.miniCodeEnv, codeResp.Body.String())
	}
	defaultEnvResp := lineupRequest(router, http.MethodGet, "/matches/"+matchID.String()+"/lineup/mini-code", "")
	if defaultEnvResp.Code != http.StatusOK || service.miniCodeEnv != "release" {
		t.Fatalf("默认 env 应为 release，got %d env=%q", defaultEnvResp.Code, service.miniCodeEnv)
	}
}

func TestLineupHandlerRejectsInvalidInputAndMapsErrors(t *testing.T) {
	matchID := uuid.New()
	service := &fakeLineupService{}
	router := newLineupTestRouter(service)

	if rec := lineupRequest(router, http.MethodGet, "/matches/not-a-uuid/lineup", ""); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("非法 match id 应返回 422，得到 %d", rec.Code)
	}
	if rec := lineupRequest(router, http.MethodPut, "/matches/"+matchID.String()+"/lineup", "{bad-json"); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("非法 JSON 应返回 422，得到 %d", rec.Code)
	}
	if rec := lineupRequest(router, http.MethodGet, "/matches/"+matchID.String()+"/lineup/mini-code?env=staging", ""); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("非法 env 应返回 422，得到 %d", rec.Code)
	}
	if service.saveCalls != 0 || service.miniCodeCalls != 0 {
		t.Fatalf("参数非法时不应调用 service: save=%d code=%d", service.saveCalls, service.miniCodeCalls)
	}

	service.saveErr = sharederror.ErrForbidden
	if rec := lineupRequest(router, http.MethodPut, "/matches/"+matchID.String()+"/lineup", `{"formation":"1-2-1","slots":[]}`); rec.Code != http.StatusForbidden {
		t.Fatalf("无权限应返回 403，得到 %d", rec.Code)
	}

	service.getErr = sharederror.New(sharederror.KindNotFound, "比赛不存在")
	if rec := lineupRequest(router, http.MethodGet, "/matches/"+matchID.String()+"/lineup", ""); rec.Code != http.StatusNotFound {
		t.Fatalf("比赛不存在应返回 404，得到 %d", rec.Code)
	}
}
