package minireviewhttp

import (
	"context"
	"crypto/subtle"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/minireview/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/minireview/domain"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type Service interface {
	Allocate(context.Context, application.AllocateCommand) (domain.MiniReviewStatus, error)
	GetReviewStatus(context.Context, string, string) (domain.MiniReviewStatus, error)
	List(context.Context, sharedauth.Actor, application.StatusListQuery) (application.StatusListResult, error)
	SetStatus(context.Context, sharedauth.Actor, application.SetStatusCommand) (domain.MiniReviewStatus, error)
	SetStatusByProjectVersion(context.Context, sharedauth.Actor, application.SetByProjectVersionCommand) (domain.MiniReviewStatus, error)
}

// Handler 小程序审核状态接口。allocateApiKey 为空时登记接口不可用（未配置 MINI_REVIEW_API_KEY）。
type Handler struct {
	service Service
	apiKey  string
}

func NewHandler(service Service, allocateApiKey string) *Handler {
	return &Handler{service: service, apiKey: strings.TrimSpace(allocateApiKey)}
}

type ReviewStatusResponse struct {
	ProjectCode string `json:"project_code"`
	Version     string `json:"version"`
	VersionCode int64  `json:"version_code"`
	IsReviewing bool   `json:"is_reviewing"`
	StatusText  string `json:"status_text"`
}

type StatusItemResponse struct {
	ID          int64      `json:"id"`
	ProjectCode string     `json:"project_code"`
	Version     string     `json:"version"`
	VersionCode int64      `json:"version_code"`
	IsReviewing bool       `json:"is_reviewing"`
	StatusText  string     `json:"status_text"`
	CreatedAt   *time.Time `json:"created_at,omitempty"`
	UpdatedAt   *time.Time `json:"updated_at,omitempty"`
}

type StatusListResponse struct {
	Items    []StatusItemResponse `json:"items"`
	Total    int64                `json:"total"`
	Page     int                  `json:"page"`
	PageSize int                  `json:"page_size"`
}

type AllocateRequest struct {
	ProjectCode     string `json:"project_code"`
	CurrentVersion  string `json:"current_version"`
	ExplicitVersion string `json:"version"`
}

type SetStatusRequest struct {
	IsReviewing bool   `json:"is_reviewing"`
	StatusText  string `json:"status_text"`
}

type SetReviewStatusRequest struct {
	ProjectCode string `json:"project_code"`
	Version     string `json:"version"`
	IsReviewing bool   `json:"is_reviewing"`
}

// RegisterPublicRoutes 小程序运行时查询：启动即可调用，不要求登录。
func (h *Handler) RegisterPublicRoutes(group *gin.RouterGroup) {
	group.GET("/mini-review/review-status", h.GetReviewStatus)
}

// RegisterAllocateRoutes 生产构建登记：静态 API key 鉴权（脚本场景无管理员会话）。
func (h *Handler) RegisterAllocateRoutes(group *gin.RouterGroup) {
	group.POST("/mini-review/allocate", h.Allocate)
}

// RegisterUserRoutes 用户端审核状态切换：登录用户即可路由进入，
// 白名单校验在 application 层（env MINI_REVIEW_CONTROL_USER_IDS）。
func (h *Handler) RegisterUserRoutes(group *gin.RouterGroup) {
	group.PUT("/mini-review/review-status", h.SetReviewStatusByProjectVersion)
}

func (h *Handler) RegisterAdminRoutes(group *gin.RouterGroup) {
	group.GET("/mini-review/statuses", h.List)
	group.PATCH("/mini-review/statuses/:id", h.SetStatus)
}

func (h *Handler) GetReviewStatus(c *gin.Context) {
	projectCode := strings.TrimSpace(c.Query("project_code"))
	version := strings.TrimSpace(c.Query("version"))
	status, err := h.service.GetReviewStatus(c.Request.Context(), projectCode, version)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapStatus(status))
}

func (h *Handler) Allocate(c *gin.Context) {
	if !h.authorizeAllocate(c.GetHeader("X-Api-Key")) {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindForbidden, "登记接口未开放或密钥无效"))
		return
	}
	var request AllocateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "登记请求格式无效"))
		return
	}
	status, err := h.service.Allocate(c.Request.Context(), application.AllocateCommand{
		ProjectCode: request.ProjectCode, CurrentVersion: request.CurrentVersion, ExplicitVersion: request.ExplicitVersion,
	})
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapStatus(status))
}

func (h *Handler) SetReviewStatusByProjectVersion(c *gin.Context) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	var request SetReviewStatusRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "切换审核状态请求格式无效"))
		return
	}
	status, err := h.service.SetStatusByProjectVersion(c.Request.Context(), actor, application.SetByProjectVersionCommand{
		ProjectCode: request.ProjectCode, Version: request.Version, IsReviewing: request.IsReviewing,
	})
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapStatus(status))
}

func (h *Handler) authorizeAllocate(presentedKey string) bool {
	if h.apiKey == "" || presentedKey == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(h.apiKey), []byte(presentedKey)) == 1
}

func (h *Handler) List(c *gin.Context) {
	actor, ok := adminActor(c)
	if !ok {
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	result, err := h.service.List(c.Request.Context(), actor, application.StatusListQuery{
		ProjectCode: c.Query("project_code"), Page: page, PageSize: pageSize,
	})
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	items := make([]StatusItemResponse, 0, len(result.Items))
	for _, status := range result.Items {
		items = append(items, mapStatusItem(status))
	}
	sharedhttpapi.WriteSuccess(c, StatusListResponse{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

func (h *Handler) SetStatus(c *gin.Context) {
	actor, ok := adminActor(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "审核版本 ID 无效"))
		return
	}
	var request SetStatusRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "审核状态请求格式无效"))
		return
	}
	status, err := h.service.SetStatus(c.Request.Context(), actor, application.SetStatusCommand{
		ID: id, IsReviewing: request.IsReviewing, StatusText: request.StatusText,
	})
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapStatus(status))
}

func adminActor(c *gin.Context) (sharedauth.Actor, bool) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
	}
	return actor, ok
}

func mapStatus(status domain.MiniReviewStatus) ReviewStatusResponse {
	return ReviewStatusResponse{
		ProjectCode: status.ProjectCode, Version: status.Version, VersionCode: status.VersionCode,
		IsReviewing: status.IsReviewing, StatusText: status.StatusText,
	}
}

func mapStatusItem(status domain.MiniReviewStatus) StatusItemResponse {
	response := StatusItemResponse{
		ID: status.ID, ProjectCode: status.ProjectCode, Version: status.Version, VersionCode: status.VersionCode,
		IsReviewing: status.IsReviewing, StatusText: status.StatusText,
	}
	if !status.CreatedAt.IsZero() {
		createdAt := status.CreatedAt
		response.CreatedAt = &createdAt
	}
	if !status.UpdatedAt.IsZero() {
		updatedAt := status.UpdatedAt
		response.UpdatedAt = &updatedAt
	}
	return response
}
