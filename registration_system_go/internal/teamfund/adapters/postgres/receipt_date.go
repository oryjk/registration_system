package postgres

import (
	"github.com/jackc/pgx/v5/pgtype"
	"time"
)

func receiptDate(date *time.Time) pgtype.Date {
	if date == nil {
		return pgtype.Date{}
	}
	return pgtype.Date{Time: *date, Valid: true}
}
