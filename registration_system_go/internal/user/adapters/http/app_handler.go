package userhttp

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
)

const maxAvatarUploadBytes = 5 << 20

type AppUsers interface {
	GetMe(context.Context, sharedauth.Actor) (domain.User, error)
	UpdateMe(context.Context, sharedauth.Actor, application.UpdateMeCommand) (domain.User, error)
}

// AvatarUploader 持久化头像文件并返回可公开访问的相对路径（如 /uploads/avatars/1.png）。
type AvatarUploader interface {
	SaveUserAvatar(userID int64, extension string, data []byte) (string, error)
}

type AppHandler struct {
	users         AppUsers
	avatars       AvatarUploader
	publicBaseURL string
}

type UpdateMeRequest struct {
	Nickname  *string `json:"nickname"`
	RealName  *string `json:"real_name"`
	AvatarURL *string `json:"avatar_url"`
}

func NewAppHandler(users AppUsers, avatars AvatarUploader, publicBaseURL string) *AppHandler {
	return &AppHandler{users: users, avatars: avatars, publicBaseURL: strings.TrimRight(strings.TrimSpace(publicBaseURL), "/")}
}

func (h *AppHandler) GetMe(c *gin.Context) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	user, err := h.users.GetMe(c.Request.Context(), actor)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapProfileResponse(user))
}

func (h *AppHandler) UpdateMe(c *gin.Context) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	var request UpdateMeRequest
	if err := c.ShouldBindJSON(&request); err != nil || request.Nickname == nil && request.RealName == nil && request.AvatarURL == nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "用户资料无效"))
		return
	}
	user, err := h.users.UpdateMe(c.Request.Context(), actor, application.UpdateMeCommand{
		Nickname:  request.Nickname,
		RealName:  request.RealName,
		AvatarURL: request.AvatarURL,
	})
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapProfileResponse(user))
}

// UploadAvatar 接收 multipart 表单字段 file，保存头像文件并把头像地址写回用户资料。
func (h *AppHandler) UploadAvatar(c *gin.Context) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	if h.avatars == nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindInternal, "头像上传未配置"))
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "请选择要上传的头像文件"))
		return
	}
	if fileHeader.Size <= 0 || fileHeader.Size > maxAvatarUploadBytes {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "头像文件大小需在 5MB 以内"))
		return
	}
	extension, ok := detectAvatarExtension(fileHeader.Header.Get("Content-Type"), fileHeader.Filename)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "头像仅支持 JPG、PNG、WebP 格式"))
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.Wrap(sharederror.KindInternal, "读取头像文件失败", err))
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxAvatarUploadBytes+1))
	if err != nil || len(data) == 0 || len(data) > maxAvatarUploadBytes {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "头像文件大小需在 5MB 以内"))
		return
	}

	relativePath, err := h.avatars.SaveUserAvatar(actor.ID, extension, data)
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.Wrap(sharederror.KindInternal, "保存头像文件失败", err))
		return
	}
	avatarURL := h.publicAvatarURL(c, relativePath)
	if _, err := h.users.UpdateMe(c.Request.Context(), actor, application.UpdateMeCommand{AvatarURL: &avatarURL}); err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, gin.H{"avatar_url": avatarURL})
}

func (h *AppHandler) RegisterAppRoutes(group *gin.RouterGroup) {
	group.GET("/users/me", h.GetMe)
	group.PATCH("/users/me", h.UpdateMe)
	group.POST("/users/me/avatar", h.UploadAvatar)
	// 兼容已发布小程序（审核周期长，下一版本才切换到 /users/me/avatar）。
	group.POST("/user/avatar", h.UploadAvatar)
}

func (h *AppHandler) publicAvatarURL(c *gin.Context, relativePath string) string {
	if h.publicBaseURL != "" {
		return h.publicBaseURL + relativePath
	}
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	if forwarded := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")); forwarded != "" {
		scheme = strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}
	host := strings.TrimSpace(c.GetHeader("X-Forwarded-Host"))
	if host == "" {
		host = c.Request.Host
	}
	if host == "" {
		return relativePath
	}
	return fmt.Sprintf("%s://%s%s", scheme, strings.TrimSpace(strings.Split(host, ",")[0]), relativePath)
}

func detectAvatarExtension(contentType, fileName string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0])) {
	case "image/jpeg", "image/jpg":
		return "jpg", true
	case "image/png":
		return "png", true
	case "image/webp":
		return "webp", true
	}
	lowerName := strings.ToLower(strings.TrimSpace(fileName))
	switch {
	case strings.HasSuffix(lowerName, ".jpg"), strings.HasSuffix(lowerName, ".jpeg"):
		return "jpg", true
	case strings.HasSuffix(lowerName, ".png"):
		return "png", true
	case strings.HasSuffix(lowerName, ".webp"):
		return "webp", true
	}
	return "", false
}

func mapProfileResponse(user domain.User) ProfileResponse {
	return ProfileResponse{
		ID: user.ID, Nickname: user.Nickname, AvatarURL: user.AvatarURL,
		RealName: user.RealName, PhoneNumber: user.PhoneNumber, Status: string(user.Status),
	}
}
