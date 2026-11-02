package application

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strings"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/shared/imagefile"
	"github.com/oryjk/registration_system/registration_system_go/internal/venue/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/venue/ports"
)

const MaxImageUploadBytes = 2 << 20

type ImageService struct {
	repository ports.Repository
	store      ports.ImageStore
}

func NewImageService(repository ports.Repository, store ports.ImageStore) ImageService {
	return ImageService{repository: repository, store: store}
}

func (s ImageService) Upload(ctx context.Context, actor sharedauth.Actor, data []byte) (string, error) {
	if !actor.IsAdmin() {
		return "", sharederror.ErrForbidden
	}
	if len(data) == 0 || len(data) > MaxImageUploadBytes {
		return "", sharederror.New(sharederror.KindValidation, "球场图片大小需在 2MB 以内")
	}
	image, ok := imagefile.ValidateRasterImage(data)
	if !ok {
		return "", sharederror.New(sharederror.KindValidation, "球场图片需为有效的 PNG、JPG、WebP 图片且不超过1600万像素")
	}
	if s.store == nil {
		return "", sharederror.New(sharederror.KindInternal, "球场图片上传存储未配置")
	}
	digest := sha256.Sum256(data)
	key := fmt.Sprintf("venue-images/%x.%s", digest[:16], image.Extension)
	imageURL, err := s.store.Save(ctx, key, image.ContentType, data)
	if err != nil {
		return "", sharederror.Wrap(sharederror.KindInternal, "上传球场图片失败", err)
	}
	return imageURL, nil
}

func (s ImageService) SetImage(ctx context.Context, actor sharedauth.Actor, name, rawImageURL string) error {
	if !actor.IsAdmin() {
		return sharederror.ErrForbidden
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return sharederror.New(sharederror.KindValidation, "球场名称不能为空")
	}
	imageURL, err := domain.NormalizeImageURL(rawImageURL)
	if err != nil {
		return err
	}
	if err := s.repository.SetImage(ctx, name, imageURL); err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "保存球场图片失败", err)
	}
	return nil
}
