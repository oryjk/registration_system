package domain

import (
	"testing"
	"time"
)

func TestNewMatchCoverImageValidation(t *testing.T) {
	for _, tt := range []struct {
		name    string
		value   *string
		want    string
		invalid bool
	}{
		{name: "omitted"}, {name: "default", value: coverString("")},
		{name: "https", value: coverString(" https://example.com/cover.webp "), want: "https://example.com/cover.webp"},
		{name: "http", value: coverString("http://example.com/cover.png"), want: "http://example.com/cover.png"},
		{name: "script", value: coverString("javascript:alert(1)"), invalid: true},
		{name: "relative", value: coverString("/cover.png"), invalid: true},
		{name: "missing host", value: coverString("https:///cover.png"), invalid: true},
		{name: "credentials", value: coverString("https://user:pass@example.com/cover.png"), invalid: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			input := validInput(OnlineTeam)
			input.CoverImageURL = tt.value
			match, _, err := NewMatch(input, IndividualLimits{})
			if tt.invalid {
				if err == nil {
					t.Fatal("expected invalid cover URL")
				}
				return
			}
			if err != nil || match.CoverImageURL != tt.want {
				t.Fatalf("cover=%q err=%v want=%q", match.CoverImageURL, err, tt.want)
			}
		})
	}
}

func TestMatchUpdateCoverPreservesReplacesAndClears(t *testing.T) {
	for _, tt := range []struct {
		name    string
		value   *string
		want    string
		invalid bool
	}{
		{name: "omitted", want: "https://example.com/old.webp"},
		{name: "replace", value: coverString("https://example.com/new.webp"), want: "https://example.com/new.webp"},
		{name: "clear", value: coverString("")},
		{name: "invalid", value: coverString("data:image/svg+xml,<svg/>"), want: "https://example.com/old.webp", invalid: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			input := validInput(OnlineTeam)
			match, _, err := NewMatch(input, IndividualLimits{})
			if err != nil {
				t.Fatal(err)
			}
			match.CoverImageURL = "https://example.com/old.webp"
			err = match.UpdateDetails(UpdateMatchDetails{Name: match.Name, StartTime: match.StartTime, EndTime: match.EndTime, Location: match.Location, CoverImageURL: tt.value}, time.Now().UTC())
			if (err != nil) != tt.invalid || match.CoverImageURL != tt.want {
				t.Fatalf("cover=%q err=%v want=%q invalid=%v", match.CoverImageURL, err, tt.want, tt.invalid)
			}
		})
	}
}
func coverString(s string) *string { return &s }
