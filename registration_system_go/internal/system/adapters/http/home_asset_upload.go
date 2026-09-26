package systemhttp

import (
	"github.com/gin-gonic/gin"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/domain"
	"io"
	"net/http"
)

func (h *Handler) UploadHomeShareImage(c *gin.Context) { h.uploadHomeImage(c, "share") }

// UploadHomeNextMatchSocialImage 接收 multipart 字段 file，上传插画并把 URL 写入 home 分区。
// 校验与存储在 application.HomeAssetService；这里只做协议适配。
func (h *Handler) UploadHomeNextMatchSocialImage(c *gin.Context) {
	h.uploadHomeImage(c, "social")
}

func (h *Handler) UploadHomeOnboardingImage(c *gin.Context) {
	h.uploadHomeImage(c, "onboarding")
}

func (h *Handler) uploadHomeImage(c *gin.Context, kind string) {
	if h.homeAssets == nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindInternal, "图片上传未配置"))
		return
	}
	// 请求体上限 = 文件上限 + 1MB multipart 开销余量，防止超大表单耗尽内存。
	maxBodyBytes := int64(application.MaxHomeAssetUploadBytes) + 1<<20
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBodyBytes)

	fileHeader, err := c.FormFile("file")
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "请选择要上传的插画文件"))
		return
	}
	file, err := fileHeader.Open()
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.Wrap(sharederror.KindInternal, "读取插画文件失败", err))
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, application.MaxHomeAssetUploadBytes+1))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.Wrap(sharederror.KindInternal, "读取插画文件失败", err))
		return
	}

	var settings domain.MiniAppSettings
	if kind == "share" {
		settings, err = h.homeAssets.UploadShareImage(c.Request.Context(), c.Param("scene"), fileHeader.Header.Get("Content-Type"), fileHeader.Filename, data)
	} else if kind == "onboarding" {
		settings, err = h.homeAssets.UploadOnboardingImage(c.Request.Context(), c.Param("scene"), fileHeader.Header.Get("Content-Type"), fileHeader.Filename, data)
	} else {
		settings, err = h.homeAssets.UploadNextMatchSocialImage(c.Request.Context(), fileHeader.Header.Get("Content-Type"), fileHeader.Filename, data)
	}
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, settings)
}
