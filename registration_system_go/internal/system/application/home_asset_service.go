package application

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/ports"
)

// MaxHomeAssetUploadBytes 限制首页运营图片体积（2MB），与头像限制同量级。
const MaxHomeAssetUploadBytes = 2 << 20

// homeNextMatchSocialKeyPrefix 是「下一场还没安排」插画的受控对象前缀。
// 对象名用内容哈希，保证替换素材时 URL 变化、不撞客户端图片缓存。
const homeNextMatchSocialKeyPrefix = "static/home/next-match-social/"

// HomeAssetService 承担首页运营图片的上传用例：校验 → 存对象 → 写配置。
// MinIO 凭据只存在于 AssetStore 适配器，本层与 HTTP 层都不感知。
type HomeAssetService struct {
	assets   ports.AssetStore
	settings SettingsService
}

func NewHomeAssetService(assets ports.AssetStore, settings SettingsService) HomeAssetService {
	return HomeAssetService{assets: assets, settings: settings}
}

// UploadNextMatchSocialImage 校验并保存插画，成功后把公网 URL 写入 home 分区。
// contentType 与 fileName 是客户端可控的声明，保留在签名里只为显式标记不可信边界，
// 不参与任何判定；格式一律按文件头 magic bytes 识别，object key 扩展名与落库
// Content-Type 都用检测结果。存储失败时不会写入配置；配置保存失败时对象可能已上传，
// 重传即可覆盖（同内容同 key）。
func (s HomeAssetService) UploadNextMatchSocialImage(ctx context.Context, contentType, fileName string, data []byte) (domain.MiniAppSettings, error) {
	if s.assets == nil {
		return domain.MiniAppSettings{}, sharederror.New(sharederror.KindInternal, "图片上传存储未配置")
	}
	if len(data) == 0 || len(data) > MaxHomeAssetUploadBytes {
		return domain.MiniAppSettings{}, sharederror.New(sharederror.KindValidation, "插画文件大小需在 2MB 以内")
	}
	image, ok := detectHomeImageByContent(data)
	if !ok {
		return domain.MiniAppSettings{}, sharederror.New(sharederror.KindValidation, "插画仅支持 PNG、JPG、WebP 格式")
	}

	objectKey := fmt.Sprintf("%s%s.%s", homeNextMatchSocialKeyPrefix, contentHash(data), image.Extension)
	url, err := s.assets.Save(ctx, objectKey, image.ContentType, data)
	if err != nil {
		return domain.MiniAppSettings{}, sharederror.Wrap(sharederror.KindInternal, "上传插画到对象存储失败", err)
	}
	return s.settings.UpdateHome(ctx, HomeSettingsPatch{NextMatchSocialImageURL: &url})
}

// detectedHomeImage 是按文件内容识别出的可信格式。
type detectedHomeImage struct {
	Extension   string
	ContentType string
}

// detectHomeImageByContent 只认文件头 magic bytes：PNG/JPEG/WebP 之外的请求一律拒绝，
// 防止把 HTML/SVG 等内容以图片 Content-Type 存进公网对象存储。
// 不用 http.DetectContentType：它无法识别 WebP。
func detectHomeImageByContent(data []byte) (detectedHomeImage, bool) {
	switch {
	case bytes.HasPrefix(data, []byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}):
		return detectedHomeImage{Extension: "png", ContentType: "image/png"}, true
	case bytes.HasPrefix(data, []byte{0xFF, 0xD8, 0xFF}):
		return detectedHomeImage{Extension: "jpg", ContentType: "image/jpeg"}, true
	case len(data) >= 12 && string(data[0:4]) == "RIFF" && string(data[8:12]) == "WEBP":
		return detectedHomeImage{Extension: "webp", ContentType: "image/webp"}, true
	default:
		return detectedHomeImage{}, false
	}
}

func contentHash(data []byte) string {
	digest := sha256.Sum256(data)
	return hex.EncodeToString(digest[:8])
}
