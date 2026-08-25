package matchhttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
)

type fakeCaptainMessages struct {
	actor    sharedauth.Actor
	sendID   uuid.UUID
	replyID  uuid.UUID
	thread   application.CaptainMessageThreadDetail
	list     application.CaptainMessageListResult
	sendErr  error
	sendCall int
}

func (f *fakeCaptainMessages) Send(_ context.Context, actor sharedauth.Actor, _ uuid.UUID, _ string) (uuid.UUID, error) {
	f.actor = actor
	f.sendCall++
	return f.sendID, f.sendErr
}

func (f *fakeCaptainMessages) Reply(_ context.Context, actor sharedauth.Actor, _ uuid.UUID, _ string) (uuid.UUID, error) {
	f.actor = actor
	return f.replyID, nil
}

func (f *fakeCaptainMessages) ListThreads(_ context.Context, actor sharedauth.Actor, _ application.CaptainMessageListQuery) (application.CaptainMessageListResult, error) {
	f.actor = actor
	return f.list, nil
}

func (f *fakeCaptainMessages) GetThread(_ context.Context, actor sharedauth.Actor, _ uuid.UUID) (application.CaptainMessageThreadDetail, error) {
	f.actor = actor
	return f.thread, nil
}

func (f *fakeCaptainMessages) UnreadCount(_ context.Context, actor sharedauth.Actor) (int64, error) {
	f.actor = actor
	return 0, nil
}

func newCaptainMessageTestRouter(service CaptainMessageUseCase) *gin.Engine {
	gin.SetMode(gin.TestMode)
	handler := NewCaptainMessageHandler(service)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeUserTokens{}).RequireUser())
	handler.RegisterRoutes(group)
	return router
}

func captainMessageRequest(router *gin.Engine, method, path string, body string) *httptest.ResponseRecorder {
	var reader *bytes.Reader
	if body == "" {
		reader = bytes.NewReader(nil)
	} else {
		reader = bytes.NewReader([]byte(body))
	}
	request := httptest.NewRequest(method, path, reader)
	request.Header.Set("Authorization", "Bearer user-token")
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func TestCaptainMessageRoutesReturnThreadData(t *testing.T) {
	threadID := uuid.New()
	matchID := uuid.New()
	avatar := "https://cdn.example.com/captain.png"
	service := &fakeCaptainMessages{
		sendID:  threadID,
		replyID: threadID,
		list: application.CaptainMessageListResult{
			Items: []ports.CaptainMessageThread{{
				ID: threadID, MatchID: matchID, TeamID: 7, ThreadOwnerUserID: 42,
				MatchName: "周末约球", HostTeamName: "东安联队", OwnerNickname: "阿睿",
				OwnerAvatarURL: &avatar, LatestContent: "可以约一场吗？",
				LatestSenderIsCaptainSide: false, LatestCreatedAt: time.Date(2026, 8, 25, 10, 0, 0, 0, time.UTC),
			}},
			Total: 1, Page: 1, PageSize: 20,
		},
		thread: application.CaptainMessageThreadDetail{
			Thread: ports.CaptainMessage{ID: threadID, MatchID: matchID, TeamID: 7, ThreadOwnerUserID: 42,
				MatchName: "周末约球", HostTeamName: "东安联队"},
			Messages: []ports.CaptainMessage{{
				ID: uuid.New(), SenderUserID: 42, Content: "可以约一场吗？",
				CreatedAt: time.Date(2026, 8, 25, 10, 0, 0, 0, time.UTC), SenderNickname: "阿睿",
			}},
		},
	}
	router := newCaptainMessageTestRouter(service)

	listResponse := captainMessageRequest(router, http.MethodGet, "/captain-messages?page=1&page_size=20", "")
	if listResponse.Code != http.StatusOK || !bytes.Contains(listResponse.Body.Bytes(), []byte(`"host_team_name":"东安联队"`)) {
		t.Fatalf("unexpected list response %d: %s", listResponse.Code, listResponse.Body.String())
	}

	detailResponse := captainMessageRequest(router, http.MethodGet, "/captain-messages/"+threadID.String(), "")
	if detailResponse.Code != http.StatusOK || !bytes.Contains(detailResponse.Body.Bytes(), []byte(`"viewer_is_manager":false`)) {
		t.Fatalf("unexpected detail response %d: %s", detailResponse.Code, detailResponse.Body.String())
	}

	sendResponse := captainMessageRequest(router, http.MethodPost, "/matches/"+matchID.String()+"/captain-messages", `{"content":"你好"}`)
	if sendResponse.Code != http.StatusOK || !bytes.Contains(sendResponse.Body.Bytes(), []byte(`"thread_id":"`+threadID.String()+`"`)) {
		t.Fatalf("unexpected send response %d: %s", sendResponse.Code, sendResponse.Body.String())
	}
	if service.actor.Kind != sharedauth.ActorUser || service.actor.ID != 42 || service.sendCall != 1 {
		t.Fatalf("unexpected send actor/calls: %+v %d", service.actor, service.sendCall)
	}

	replyResponse := captainMessageRequest(router, http.MethodPost, "/captain-messages/"+threadID.String()+"/reply", `{"content":"欢迎"}`)
	if replyResponse.Code != http.StatusOK {
		t.Fatalf("unexpected reply response %d: %s", replyResponse.Code, replyResponse.Body.String())
	}
}

func TestCaptainMessageRoutesRejectInvalidInput(t *testing.T) {
	service := &fakeCaptainMessages{sendID: uuid.New()}
	router := newCaptainMessageTestRouter(service)

	badMatch := captainMessageRequest(router, http.MethodPost, "/matches/not-a-uuid/captain-messages", `{"content":"你好"}`)
	if badMatch.Code != http.StatusUnprocessableEntity {
		t.Fatalf("invalid match id must be 422, got %d", badMatch.Code)
	}
	badThread := captainMessageRequest(router, http.MethodGet, "/captain-messages/not-a-uuid", "")
	if badThread.Code != http.StatusUnprocessableEntity {
		t.Fatalf("invalid thread id must be 422, got %d", badThread.Code)
	}
	emptyBody := captainMessageRequest(router, http.MethodPost, "/matches/"+uuid.NewString()+"/captain-messages", `{"content":""}`)
	if emptyBody.Code != http.StatusUnprocessableEntity {
		t.Fatalf("empty content must be 422, got %d", emptyBody.Code)
	}
	if service.sendCall != 0 {
		t.Fatalf("service must not be called on invalid input, got %d calls", service.sendCall)
	}
}
