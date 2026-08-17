package ports

import "time"

// Clock 供 application 注入的时钟，测试里可固定时间。
type Clock interface {
	Now() time.Time
}
