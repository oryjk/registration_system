package matchhttp

import (
	"context"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// VenueSuggestionUseCase 发布页常用场地建议。
type VenueSuggestionUseCase interface {
	Suggestions(ctx context.Context, actor sharedauth.Actor, limit int) ([]ports.VenueSuggestion, error)
}

type VenueSuggestionHandler struct {
	venues VenueSuggestionUseCase
}

func NewVenueSuggestionHandler(venues VenueSuggestionUseCase) *VenueSuggestionHandler {
	return &VenueSuggestionHandler{venues: venues}
}

func (h *VenueSuggestionHandler) RegisterRoutes(group *gin.RouterGroup) {
	group.GET("/venues/suggestions", h.Suggestions)
}

type VenueSuggestionResponse struct {
	Location   string   `json:"location"`
	Latitude   *float64 `json:"latitude"`
	Longitude  *float64 `json:"longitude"`
	UseCount   int64    `json:"use_count"`
	LastUsedAt string   `json:"last_used_at"`
}

// Suggestions 常用场地列表（登录用户；limit 可选，默认 10、上限 20）。
func (h *VenueSuggestionHandler) Suggestions(c *gin.Context) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	limit, err := strconv.Atoi(c.Query("limit"))
	if err != nil {
		limit = 0
	}
	items, err := h.venues.Suggestions(c.Request.Context(), actor, limit)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	responses := make([]VenueSuggestionResponse, 0, len(items))
	for _, item := range items {
		lastUsedAt := ""
		if !item.LastUsedAt.IsZero() {
			lastUsedAt = item.LastUsedAt.UTC().Format(time.RFC3339)
		}
		responses = append(responses, VenueSuggestionResponse{
			Location: item.Location, Latitude: item.Latitude, Longitude: item.Longitude,
			UseCount: item.UseCount, LastUsedAt: lastUsedAt,
		})
	}
	sharedhttpapi.WriteSuccess(c, responses)
}
