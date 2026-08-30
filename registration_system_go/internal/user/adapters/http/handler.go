package userhttp

import (
	"context"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
)

type ProfileUpdater interface {
	Update(context.Context, sharedauth.Actor, int64, string, string) (domain.User, error)
}

// AdminUsers 管理端微信用户管理：搜索用户、设置/取消比赛管理员。
type AdminUsers interface {
	List(context.Context, sharedauth.Actor, application.AdminUserListQuery) (application.AdminUserListResult, error)
	SetMatchAdmin(context.Context, sharedauth.Actor, int64, bool) (domain.User, error)
}

type Handler struct {
	profiles ProfileUpdater
	users    AdminUsers
}

type UpdateProfileRequest struct {
	RealName    *string `json:"real_name"`
	PhoneNumber *string `json:"phone_number"`
}

type ProfileResponse struct {
	ID          int64   `json:"id"`
	Nickname    string  `json:"nickname"`
	AvatarURL   *string `json:"avatar_url"`
	RealName    *string `json:"real_name"`
	PhoneNumber *string `json:"phone_number"`
	Status      string  `json:"status"`
	// IsMatchAdmin 是否为比赛管理员：可在小程序端录入比赛比分。
	IsMatchAdmin bool `json:"is_match_admin"`
}

// AdminUserResponse 管理端的微信用户条目（不暴露 openid）。
type AdminUserResponse struct {
	ID           int64     `json:"id"`
	Nickname     string    `json:"nickname"`
	AvatarURL    *string   `json:"avatar_url"`
	RealName     *string   `json:"real_name"`
	PhoneNumber  *string   `json:"phone_number"`
	Status       string    `json:"status"`
	IsMatchAdmin bool      `json:"is_match_admin"`
	CreatedAt    time.Time `json:"created_at"`
}

type AdminUserListResponse struct {
	Items    []AdminUserResponse `json:"items"`
	Total    int64               `json:"total"`
	Page     int                 `json:"page"`
	PageSize int                 `json:"page_size"`
}

func NewHandler(profiles ProfileUpdater, users AdminUsers) *Handler {
	return &Handler{profiles: profiles, users: users}
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	userID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || userID <= 0 {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "球员 ID 无效"))
		return
	}
	var request UpdateProfileRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "球员资料无效"))
		return
	}
	user, err := h.profiles.Update(c.Request.Context(), actor, userID, stringValue(request.RealName), stringValue(request.PhoneNumber))
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, ProfileResponse{
		ID: user.ID, Nickname: user.Nickname, AvatarURL: user.AvatarURL,
		RealName: user.RealName, PhoneNumber: user.PhoneNumber, Status: string(user.Status),
	})
}

func (h *Handler) RegisterAdminRoutes(group *gin.RouterGroup) {
	group.PATCH("/users/:id/profile", h.UpdateProfile)
	group.GET("/users", h.ListUsers)
	group.PUT("/users/:id/match-admin", h.SetMatchAdmin)
	group.DELETE("/users/:id/match-admin", h.UnsetMatchAdmin)
}

// ListUsers GET /users：按昵称/姓名/手机号/用户 ID 搜索微信用户，可只看比赛管理员。
func (h *Handler) ListUsers(c *gin.Context) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	query := application.AdminUserListQuery{Search: c.Query("search"), MatchAdminOnly: c.Query("match_admin_only") == "true"}
	var err error
	if raw := c.Query("page"); raw != "" {
		query.Page, err = strconv.Atoi(raw)
		if err != nil {
			sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "页码无效"))
			return
		}
	}
	if raw := c.Query("page_size"); raw != "" {
		query.PageSize, err = strconv.Atoi(raw)
		if err != nil {
			sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "分页大小无效"))
			return
		}
	}
	result, err := h.users.List(c.Request.Context(), actor, query)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	items := make([]AdminUserResponse, 0, len(result.Items))
	for _, user := range result.Items {
		items = append(items, mapAdminUser(user))
	}
	sharedhttpapi.WriteSuccess(c, AdminUserListResponse{
		Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize,
	})
}

// SetMatchAdmin PUT /users/:id/match-admin：把该微信用户设为比赛管理员。
func (h *Handler) SetMatchAdmin(c *gin.Context) {
	h.changeMatchAdmin(c, true)
}

// UnsetMatchAdmin DELETE /users/:id/match-admin：取消该用户的比赛管理员身份。
func (h *Handler) UnsetMatchAdmin(c *gin.Context) {
	h.changeMatchAdmin(c, false)
}

func (h *Handler) changeMatchAdmin(c *gin.Context, enabled bool) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	userID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || userID <= 0 {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "用户 ID 无效"))
		return
	}
	user, err := h.users.SetMatchAdmin(c.Request.Context(), actor, userID, enabled)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapAdminUser(user))
}

func mapAdminUser(user domain.User) AdminUserResponse {
	return AdminUserResponse{
		ID: user.ID, Nickname: user.Nickname, AvatarURL: user.AvatarURL,
		RealName: user.RealName, PhoneNumber: user.PhoneNumber, Status: string(user.Status),
		IsMatchAdmin: user.IsMatchAdmin, CreatedAt: user.CreatedAt,
	}
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
