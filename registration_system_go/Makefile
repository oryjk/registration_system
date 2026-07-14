.PHONY: generate migrate-up migrate-down migrate-status fmt test vet build run verify

export GOSUMDB := sum.golang.org
export GOTOOLCHAIN := go1.26.5

SQLC_VERSION := v1.31.1
GOOSE_VERSION := v3.27.2

generate:
	go run github.com/sqlc-dev/sqlc/cmd/sqlc@$(SQLC_VERSION) generate

migrate-up:
	go run github.com/pressly/goose/v3/cmd/goose@$(GOOSE_VERSION) -dir db/migrations postgres "$(DATABASE_URL)" up

migrate-down:
	go run github.com/pressly/goose/v3/cmd/goose@$(GOOSE_VERSION) -dir db/migrations postgres "$(DATABASE_URL)" down

migrate-status:
	go run github.com/pressly/goose/v3/cmd/goose@$(GOOSE_VERSION) -dir db/migrations postgres "$(DATABASE_URL)" status

fmt:
	gofmt -w .

test:
	go test ./...

vet:
	go vet ./...

build:
	go build -o /tmp/registration-system-go-api ./cmd/api

run:
	go run ./cmd/api

verify: generate fmt test vet build
