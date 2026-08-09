package wechatv2

import (
	"crypto/md5"
	"crypto/subtle"
	"encoding/hex"
	"sort"
	"strings"
)

func sign(values Values, apiKey string) string {
	keys := make([]string, 0, len(values))
	for key, value := range values {
		if key != "sign" && value != "" {
			keys = append(keys, key)
		}
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys)+1)
	for _, key := range keys {
		parts = append(parts, key+"="+values[key])
	}
	parts = append(parts, "key="+apiKey)
	digest := md5.Sum([]byte(strings.Join(parts, "&")))
	return strings.ToUpper(hex.EncodeToString(digest[:]))
}

func verify(values Values, apiKey string) bool {
	actual := strings.ToUpper(strings.TrimSpace(values["sign"]))
	expected := sign(values, apiKey)
	return len(actual) == len(expected) && subtle.ConstantTimeCompare([]byte(actual), []byte(expected)) == 1
}
