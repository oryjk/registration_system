package mapping

import (
	"fmt"
	"strings"
)

type Mode string

const (
	ModeIncremental Mode = "incremental"
	ModeFull        Mode = "full"
)

func ParseMode(value string) (Mode, error) {
	switch Mode(strings.TrimSpace(value)) {
	case "", ModeIncremental:
		return ModeIncremental, nil
	case ModeFull:
		return ModeFull, nil
	default:
		return "", fmt.Errorf("mode must be incremental or full")
	}
}
