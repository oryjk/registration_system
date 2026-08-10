FROM golang:1.26.5-bookworm AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG TARGETOS=linux
ARG TARGETARCH=amd64
RUN CGO_ENABLED=0 GOOS="${TARGETOS}" GOARCH="${TARGETARCH}" \
    go build -trimpath -ldflags="-s -w" -o /out/registration-system-go-api ./cmd/api

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --create-home app

WORKDIR /app
COPY --from=builder /out/registration-system-go-api /app/registration-system-go-api

USER app
EXPOSE 18081

ENTRYPOINT ["/app/registration-system-go-api"]
