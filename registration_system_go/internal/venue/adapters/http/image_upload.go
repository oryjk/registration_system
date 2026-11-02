package venuehttp

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/venue/application"
)

type ImageUploadResponse struct {
	ImageURL string `json:"image_url"`
}

func (h *Handler) UploadImage(c *gin.Context) {
	actor, ok := adminActor(c)
	if !ok {
		return
	}
	if h.images == nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindInternal, "球场图片上传未配置"))
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, int64(application.MaxImageUploadBytes)+(1<<20))
	header, err := c.FormFile("file")
	if c.Request.MultipartForm != nil {
		defer c.Request.MultipartForm.RemoveAll()
	}
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "请选择不超过 2MB 的球场图片"))
		return
	}
	file, err := header.Open()
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.Wrap(sharederror.KindInternal, "读取球场图片失败", err))
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, application.MaxImageUploadBytes+1))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.Wrap(sharederror.KindInternal, "读取球场图片失败", err))
		return
	}
	imageURL, err := h.images.Upload(c.Request.Context(), actor, data)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, ImageUploadResponse{ImageURL: imageURL})
}
