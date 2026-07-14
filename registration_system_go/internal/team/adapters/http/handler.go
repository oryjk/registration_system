package teamhttp

import (
	"context"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

type TeamQuery interface {
	ListByUser(context.Context, int64) ([]domain.TeamMembership, error)
}

type Handler struct {
	query TeamQuery
}

type TeamMembershipResponse struct {
	ID          int64   `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	LogoURL     *string `json:"logo_url"`
	Role        string  `json:"role"`
	JoinedAt    string  `json:"joined_at"`
}

func NewHandler(query TeamQuery) *Handler {
	return &Handler{query: query}
}

func (h *Handler) MyTeams(c *gin.Context) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	items, err := h.query.ListByUser(c.Request.Context(), actor.ID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	response := make([]TeamMembershipResponse, 0, len(items))
	for _, item := range items {
		response = append(response, TeamMembershipResponse{
			ID:          item.Team.ID,
			Name:        item.Team.Name,
			Description: item.Team.Description,
			LogoURL:     item.Team.LogoURL,
			Role:        string(item.Member.Role),
			JoinedAt:    item.Member.JoinedAt.Format("2006-01-02T15:04:05"),
		})
	}
	sharedhttpapi.WriteSuccess(c, response)
}

func (h *Handler) RegisterUserRoutes(group *gin.RouterGroup) {
	group.GET("/teams/my", h.MyTeams)
}
