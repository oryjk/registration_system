// Package participation converts exact integer tenths to public participation scores.
package participation

// FromTenths converts after aggregation, so fractional rewards never accumulate
// floating-point error in storage or alter ranking tie order.
func FromTenths(value int64) float64 { return float64(value) / 10 }

func OptionalFromTenths(value *int64) *float64 {
	if value == nil {
		return nil
	}
	score := FromTenths(*value)
	return &score
}
