package mapping

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"reflect"
	"time"
)

func CanonicalJSONAndFingerprint(fields map[string]any) ([]byte, string, error) {
	normalized := make(map[string]any, len(fields))
	for key, value := range fields {
		item, err := normalizeCanonicalValue(value)
		if err != nil {
			return nil, "", fmt.Errorf("normalize %s: %w", key, err)
		}
		normalized[key] = item
	}
	canonical, err := json.Marshal(normalized)
	if err != nil {
		return nil, "", fmt.Errorf("marshal canonical JSON: %w", err)
	}
	digest := sha256.Sum256(canonical)
	return canonical, hex.EncodeToString(digest[:]), nil
}

func Fingerprint(fields map[string]any) (string, error) {
	_, digest, err := CanonicalJSONAndFingerprint(fields)
	return digest, err
}

func normalizeCanonicalValue(value any) (any, error) {
	if value == nil {
		return nil, nil
	}
	reflected := reflect.ValueOf(value)
	if reflected.Kind() == reflect.Pointer {
		if reflected.IsNil() {
			return nil, nil
		}
		return normalizeCanonicalValue(reflected.Elem().Interface())
	}
	switch item := value.(type) {
	case time.Time:
		return item.UTC().Format(time.RFC3339Nano), nil
	case string, bool,
		int, int8, int16, int32, int64,
		uint, uint8, uint16, uint32, uint64,
		float32, float64, json.Number:
		return item, nil
	case map[string]any:
		result := make(map[string]any, len(item))
		for key, nested := range item {
			normalized, err := normalizeCanonicalValue(nested)
			if err != nil {
				return nil, err
			}
			result[key] = normalized
		}
		return result, nil
	case []any:
		result := make([]any, len(item))
		for index, nested := range item {
			normalized, err := normalizeCanonicalValue(nested)
			if err != nil {
				return nil, err
			}
			result[index] = normalized
		}
		return result, nil
	default:
		return nil, fmt.Errorf("unsupported canonical value type %s", reflect.TypeOf(value))
	}
}
