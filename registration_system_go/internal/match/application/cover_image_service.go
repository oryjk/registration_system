package application

import (
	"context"
	"crypto/sha256"
	"fmt"

	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/shared/imagefile"
)

// MaxCoverImageUploadBytes matches the existing operations image limit (2MB).
const MaxCoverImageUploadBytes = 2 << 20

type CoverImageService struct{ store ports.CoverImageStore }

func NewCoverImageService(store ports.CoverImageStore) CoverImageService {
	return CoverImageService{store: store}
}

// Upload only saves an asset. The match is updated when the admin saves the form.
func (s CoverImageService) Upload(ctx context.Context, actor sharedauth.Actor, data []byte) (string, error) {
	if !actor.IsAdmin() {
		return "", sharederror.ErrForbidden
	}
	if len(data) == 0 || len(data) > MaxCoverImageUploadBytes {
		return "", sharederror.New(sharederror.KindValidation, "封面文件大小需在 2MB 以内")
	}
	image, ok := imagefile.ValidateRasterImage(data)
	if !ok {
		return "", sharederror.New(sharederror.KindValidation, "封面需为有效的 PNG、JPG、WebP 图片且不超过1600万像素")
	}
	if s.store == nil {
		return "", sharederror.New(sharederror.KindInternal, "封面上传存储未配置")
	}
	digest := sha256.Sum256(data)
	key := fmt.Sprintf("match-covers/%x.%s", digest[:16], image.Extension)
	imageURL, err := s.store.Save(ctx, key, image.ContentType, data)
	if err != nil {
		return "", sharederror.Wrap(sharederror.KindInternal, "上传比赛封面失败", err)
	}
	return imageURL, nil
}
