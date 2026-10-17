package imagefile

import (
	"testing"

	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport/imagefixture"
)

func TestValidateRasterImageRejectsTruncatedOrForgedHeaders(t *testing.T) {
	for name, data := range map[string][]byte{
		"png header":           []byte("\x89PNG\r\n\x1a\n"),
		"jpeg header":          []byte("\xff\xd8\xff"),
		"webp header":          []byte("RIFFxxxxWEBPimage"),
		"png dimensions only":  imagefixture.PNG()[:33],
		"jpeg dimensions only": imagefixture.JPEG()[:180],
		"truncated png":        imagefixture.PNG()[:20],
		"truncated jpeg":       imagefixture.JPEG()[:20],
		"truncated webp":       imagefixture.WebP()[:20],
	} {
		t.Run(name, func(t *testing.T) {
			if _, ok := ValidateRasterImage(data); ok {
				t.Fatal("invalid image header must not be accepted")
			}
		})
	}
}

func TestValidateRasterImageAcceptsRealSupportedImages(t *testing.T) {
	for _, tt := range []struct {
		name                   string
		data                   []byte
		extension, contentType string
	}{
		{"png", imagefixture.PNG(), "png", "image/png"},
		{"jpeg", imagefixture.JPEG(), "jpg", "image/jpeg"},
		{"webp", imagefixture.WebP(), "webp", "image/webp"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := ValidateRasterImage(tt.data)
			if !ok || got.Extension != tt.extension || got.ContentType != tt.contentType {
				t.Fatalf("image=%+v accepted=%v", got, ok)
			}
		})
	}
}

func TestValidateRasterImageRejectsExcessivePixelBudget(t *testing.T) {
	if _, ok := ValidateRasterImage(imagefixture.OverBudgetPNG()); ok {
		t.Fatal("16008001-pixel image must be rejected before allocation")
	}
}
