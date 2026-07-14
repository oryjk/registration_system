.PHONY: fmt test vet build run verify

export GOSUMDB := sum.golang.org

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

verify: fmt test vet build
