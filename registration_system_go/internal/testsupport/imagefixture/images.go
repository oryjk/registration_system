// Package imagefixture provides small real images for upload boundary tests.
package imagefixture

import _ "embed"

//go:embed testdata/one-pixel.png
var pngImage []byte

//go:embed testdata/one-pixel.jpeg
var jpegImage []byte

//go:embed testdata/one-pixel.webp
var webpImage []byte

func PNG() []byte  { return append([]byte(nil), pngImage...) }
func JPEG() []byte { return append([]byte(nil), jpegImage...) }
func WebP() []byte { return append([]byte(nil), webpImage...) }

//go:embed testdata/over-budget.png
var overBudgetPNG []byte

func OverBudgetPNG() []byte { return append([]byte(nil), overBudgetPNG...) }
