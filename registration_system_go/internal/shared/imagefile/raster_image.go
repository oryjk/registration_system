package imagefile

import (
	"bytes"
	"image"
	_ "image/jpeg"
	_ "image/png"

	_ "golang.org/x/image/webp"
)

// RasterImage describes a supported image format detected from its content.
type RasterImage struct {
	Extension   string
	ContentType string
}

// DetectRasterImage retains the existing operations-upload format recognition.
// It only recognizes magic bytes, allowing older system uploads to keep working.
func DetectRasterImage(data []byte) (RasterImage, bool) {
	switch {
	case bytes.HasPrefix(data, []byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}):
		return RasterImage{Extension: "png", ContentType: "image/png"}, true
	case bytes.HasPrefix(data, []byte{0xFF, 0xD8, 0xFF}):
		return RasterImage{Extension: "jpg", ContentType: "image/jpeg"}, true
	case len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP":
		return RasterImage{Extension: "webp", ContentType: "image/webp"}, true
	default:
		return RasterImage{}, false
	}
}

// MaxRasterImagePixels bounds decoded image memory independently of file size.
const MaxRasterImagePixels = 16_000_000

// ValidateRasterImage is the stricter contract for new cover uploads: identify
// a supported format, reject excessive dimensions before allocating pixels,
// and then decode the actual image so a dimensions-only header cannot pass.
func ValidateRasterImage(data []byte) (RasterImage, bool) {
	detected, ok := DetectRasterImage(data)
	if !ok {
		return RasterImage{}, false
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 || config.Width > MaxRasterImagePixels/config.Height {
		return RasterImage{}, false
	}
	_, decodedFormat, err := image.Decode(bytes.NewReader(data))
	if err != nil || decodedFormat != format {
		return RasterImage{}, false
	}
	return detected, true
}
