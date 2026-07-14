package main

import (
	"errors"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/bootstrap"
)

func main() {
	config, err := bootstrap.LoadConfig()
	if err != nil {
		slog.Error("load configuration", "error", err)
		os.Exit(1)
	}

	server := &http.Server{
		Addr:              config.HTTPAddr,
		Handler:           bootstrap.NewRouter(bootstrap.Dependencies{}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	slog.Info("starting HTTP server", "address", config.HTTPAddr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("HTTP server stopped", "error", err)
		os.Exit(1)
	}
}
