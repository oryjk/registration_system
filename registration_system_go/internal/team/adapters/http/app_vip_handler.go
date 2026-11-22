package teamhttp

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

type AppTeamVipQueries interface {
	GetStatus(ctx context.Context, actor sharedauth.Actor, teamID int64) (application.VipStatusView, error)
	ListShareBackgrounds(ctx context.Context, actor sharedauth.Actor, teamID int64) (application.ShareBackgroundListView, error)
}

type AppVipHandler struct {
	vip AppTeamVipQueries
}

func NewAppVipHandler(vip AppTeamVipQueries) *AppVipHandler {
	return &AppVipHandler{vip: vip}
}

func (h *AppVipHandler) RegisterRoutes(group *gin.RouterGroup) {
	group.GET("/teams/:id/vip", h.GetStatus)
	group.GET("/teams/:id/share-backgrounds", h.ListShareBackgrounds)
}

type AppTeamVipResponse struct {
	TeamID            int64                `json:"team_id"`
	IsVip             bool                 `json:"is_vip"`
	VipUntil          *time.Time           `json:"vip_until"`
	VipCredits        int                  `json:"vip_credits"`
	DefaultShareBgURL string               `json:"default_share_bg_url"`
	Plans             []domain.VipPlanSpec `json:"plans"`
	Benefits          []domain.VipBenefit  `json:"benefits"`
	FreeTierNote      string               `json:"free_tier_note"`
}

type AppShareBackgroundItemResponse struct {
	ID        int64     `json:"id"`
	ImageURL  string    `json:"image_url"`
	CreatedAt time.Time `json:"created_at"`
}

type AppShareBackgroundListResponse struct {
	Items           []AppShareBackgroundItemResponse `json:"items"`
	DefaultImageURL string                           `json:"default_image_url"`
}

func (h *AppVipHandler) GetStatus(c *gin.Context) {
	actor, teamID, ok := appActorAndTeamID(c)
	if !ok {
		return
	}
	view, err := h.vip.GetStatus(c.Request.Context(), actor, teamID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	plans := view.Plans
	if plans == nil {
		plans = []domain.VipPlanSpec{}
	}
	benefits := view.Benefits
	if benefits == nil {
		benefits = []domain.VipBenefit{}
	}
	sharedhttpapi.WriteSuccess(c, AppTeamVipResponse{
		TeamID:            view.TeamID,
		IsVip:             view.IsVip,
		VipUntil:          view.VipUntil,
		VipCredits:        view.VipCredits,
		DefaultShareBgURL: view.DefaultShareBgURL,
		Plans:             plans,
		Benefits:          benefits,
		FreeTierNote:      view.FreeTierNote,
	})
}

func (h *AppVipHandler) ListShareBackgrounds(c *gin.Context) {
	actor, teamID, ok := appActorAndTeamID(c)
	if !ok {
		return
	}
	view, err := h.vip.ListShareBackgrounds(c.Request.Context(), actor, teamID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	items := make([]AppShareBackgroundItemResponse, 0, len(view.Items))
	for _, item := range view.Items {
		items = append(items, AppShareBackgroundItemResponse{
			ID:        item.ID,
			ImageURL:  item.ImageURL,
			CreatedAt: item.CreatedAt,
		})
	}
	sharedhttpapi.WriteSuccess(c, AppShareBackgroundListResponse{
		Items:           items,
		DefaultImageURL: view.DefaultImageURL,
	})
}
