package minilinkhttp

import (
	"context"

	"github.com/gin-gonic/gin"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
)

type Service interface {
	ChanlunLink(ctx context.Context, returnQuery string) (string, error)
}

// Handler 小程序外链：公开接口，供微信外打开的 H5 引导用户进入小程序。
type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

type ChanlunLinkRequest struct {
	ReturnQuery string `json:"return_query"`
}

type LinkResponse struct {
	URL string `json:"url"`
}

func (h *Handler) RegisterPublicRoutes(group *gin.RouterGroup) {
	group.POST("/mini-links/chanlun", h.Chanlun)
}

func (h *Handler) Chanlun(c *gin.Context) {
	var request ChanlunLinkRequest
	// 请求体可省略：缺省时回到缠观首页。
	_ = c.ShouldBindJSON(&request)
	link, err := h.service.ChanlunLink(c.Request.Context(), request.ReturnQuery)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, LinkResponse{URL: link})
}
