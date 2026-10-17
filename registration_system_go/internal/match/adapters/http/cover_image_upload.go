package matchhttp

import (
	"context"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type CoverImageUploadUseCase interface {
	Upload(context.Context, sharedauth.Actor, []byte) (string, error)
}

type CoverImageUploadResponse struct {
	ImageURL string `json:"image_url"`
}

func (h *AdminHandler) UploadCoverImage(c *gin.Context) {
	actor, ok := adminActor(c)
	if !ok {
		return
	}
	if h.covers == nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindInternal, "封面上传未配置"))
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, int64(application.MaxCoverImageUploadBytes)+(1<<20))
	header, err := c.FormFile("file")
	if c.Request.MultipartForm != nil {
		defer c.Request.MultipartForm.RemoveAll()
	}
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "请选择不超过 2MB 的封面图片"))
		return
	}
	file, err := header.Open()
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.Wrap(sharederror.KindInternal, "读取封面图片失败", err))
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, application.MaxCoverImageUploadBytes+1))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.Wrap(sharederror.KindInternal, "读取封面图片失败", err))
		return
	}
	imageURL, err := h.covers.Upload(c.Request.Context(), actor, data)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, CoverImageUploadResponse{ImageURL: imageURL})
}
