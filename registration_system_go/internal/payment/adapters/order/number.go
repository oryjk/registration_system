package order

import (
	"crypto/rand"
	"encoding/hex"
	"strconv"
	"time"
)

type Generator struct{}

func (Generator) NewOrderNo() string {
	random := make([]byte, 5)
	if _, err := rand.Read(random); err != nil {
		return "P" + strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return "P" + strconv.FormatInt(time.Now().UnixMilli(), 36) + hex.EncodeToString(random)
}
