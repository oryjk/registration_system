.PHONY: generate migrate-up migrate-down migrate-status create-admin fmt test vet build run verify

export GOSUMDB := sum.golang.org
export GOTOOLCHAIN := go1.26.5

SQLC_VERSION := v1.31.1
GOOSE_VERSION := v3.27.2
ENV_FILE ?= ./.env

define with_env
	@test -f "$(ENV_FILE)" || { echo "missing $(ENV_FILE); copy .env.example to .env first"; exit 1; }; set -a; . "$(ENV_FILE)"; set +a; $(1)
endef

generate:
	go run github.com/sqlc-dev/sqlc/cmd/sqlc@$(SQLC_VERSION) generate

migrate-up:
	$(call with_env,go run github.com/pressly/goose/v3/cmd/goose@$(GOOSE_VERSION) -dir db/migrations postgres "$$DATABASE_URL" up)

migrate-down:
	$(call with_env,go run github.com/pressly/goose/v3/cmd/goose@$(GOOSE_VERSION) -dir db/migrations postgres "$$DATABASE_URL" down)

migrate-status:
	$(call with_env,go run github.com/pressly/goose/v3/cmd/goose@$(GOOSE_VERSION) -dir db/migrations postgres "$$DATABASE_URL" status)

create-admin:
	go run ./cmd/adminctl

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
