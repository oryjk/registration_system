package matchhttp

import (
	"context"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// ShareBgUseCase 定义比赛自定义分享背景 HTTP 适配器依赖的应用层能力。
type ShareBgUseCase interface {
	Upload(context.Context, sharedauth.Actor, uuid.UUID, []byte) (application.ShareBgResult, error)
	Select(context.Context, sharedauth.Actor, uuid.UUID, string) (application.ShareBgResult, error)
	Clear(context.Context, sharedauth.Actor, uuid.UUID) (application.ShareBgResult, error)
}

type ShareBgHandler struct {
	service ShareBgUseCase
}

func NewShareBgHandler(service ShareBgUseCase) *ShareBgHandler {
	return &ShareBgHandler{service: service}
}

type ShareBgResponse struct {
	ShareBgImageURL string `json:"share_bg_image_url"`
	ShareBgUnlocked bool   `json:"share_bg_unlocked"`
}

type SelectShareBgRequest struct {
	ImageURL string `json:"image_url"`
}

// Upload POST /matches/:id/share-bg：上传比赛自定义分享卡背景图（multipart 表单字段 file）。
func (h *ShareBgHandler) Upload(c *gin.Context) {
	actor, matchID, ok := shareBgActorAndMatchID(c)
	if !ok {
		return
	}
	if h.service == nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindInternal, "分享背景服务未配置"))
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, int64(application.MaxShareBgUploadBytes)+(1<<20))
	header, err := c.FormFile("file")
	if c.Request.MultipartForm != nil {
		defer c.Request.MultipartForm.RemoveAll()
	}
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "请选择不超过 2MB 的分享背景图片"))
		return
	}
	file, err := header.Open()
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.Wrap(sharederror.KindInternal, "读取分享背景图片失败", err))
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, application.MaxShareBgUploadBytes+1))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.Wrap(sharederror.KindInternal, "读取分享背景图片失败", err))
		return
	}
	result, err := h.service.Upload(c.Request.Context(), actor, matchID, data)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, ShareBgResponse{
		ShareBgImageURL: result.ShareBgImageURL,
		ShareBgUnlocked: result.ShareBgUnlocked,
	})
}

// Select PUT /matches/:id/share-bg：从球队分享背景资源库切换本场比赛背景图。
func (h *ShareBgHandler) Select(c *gin.Context) {
	actor, matchID, ok := shareBgActorAndMatchID(c)
	if !ok {
		return
	}
	if h.service == nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindInternal, "分享背景服务未配置"))
		return
	}
	var request SelectShareBgRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "分享背景参数无效"))
		return
	}
	result, err := h.service.Select(c.Request.Context(), actor, matchID, request.ImageURL)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, ShareBgResponse{
		ShareBgImageURL: result.ShareBgImageURL,
		ShareBgUnlocked: result.ShareBgUnlocked,
	})
}

// Clear DELETE /matches/:id/share-bg：清除比赛自定义分享卡背景图（保留解锁状态）。
func (h *ShareBgHandler) Clear(c *gin.Context) {
	actor, matchID, ok := shareBgActorAndMatchID(c)
	if !ok {
		return
	}
	if h.service == nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindInternal, "分享背景服务未配置"))
		return
	}
	result, err := h.service.Clear(c.Request.Context(), actor, matchID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, ShareBgResponse{
		ShareBgImageURL: result.ShareBgImageURL,
		ShareBgUnlocked: result.ShareBgUnlocked,
	})
}

func (h *ShareBgHandler) RegisterRoutes(group *gin.RouterGroup) {
	group.POST("/matches/:id/share-bg", h.Upload)
	group.PUT("/matches/:id/share-bg", h.Select)
	group.DELETE("/matches/:id/share-bg", h.Clear)
}

func shareBgActorAndMatchID(c *gin.Context) (sharedauth.Actor, uuid.UUID, bool) {
	actor, ok := userActor(c)
	if !ok {
		return sharedauth.Actor{}, uuid.Nil, false
	}
	matchID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛 ID 无效"))
		return sharedauth.Actor{}, uuid.Nil, false
	}
	return actor, matchID, true
}
