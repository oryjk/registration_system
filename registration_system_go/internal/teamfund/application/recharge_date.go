package application

import (
	"time"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func parseReceiptDate(value string) (*time.Time, error) {
	if value == "" {
		return nil, nil
	}
	date, err := time.Parse("2006-01-02", value)
	if err != nil {
		return nil, sharederror.New(sharederror.KindValidation, "收款日期格式应为 YYYY-MM-DD")
	}
	if value > time.Now().In(time.FixedZone("Asia/Shanghai", 8*60*60)).Format("2006-01-02") {
		return nil, sharederror.New(sharederror.KindValidation, "收款日期不能晚于今天")
	}
	return &date, nil
}
