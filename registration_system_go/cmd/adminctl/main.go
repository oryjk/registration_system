package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/password"
	authpostgres "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/postgres"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/shared/configenv"
)

func main() {
	configenv.Load()
	databaseURL := os.Getenv("DATABASE_URL")
	username := strings.TrimSpace(os.Getenv("ADMIN_USERNAME"))
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	role := domain.AdminRole(strings.TrimSpace(os.Getenv("ADMIN_ROLE")))
	if role == "" {
		role = domain.AdminRoleSuper
	}
	if databaseURL == "" || username == "" || adminPassword == "" {
		slog.Error("DATABASE_URL, ADMIN_USERNAME and ADMIN_PASSWORD are required")
		os.Exit(1)
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		slog.Error("open PostgreSQL", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		slog.Error("ping PostgreSQL", "error", err)
		os.Exit(1)
	}

	repository := authpostgres.NewAdminRepository(pool)
	service := application.NewAdminService(repository, password.Bcrypt{}, nil)
	admin, err := service.CreateInitial(ctx, username, adminPassword, role)
	if err != nil {
		slog.Error("create initial admin", "error", err)
		os.Exit(1)
	}
	fmt.Printf("created initial admin %s (%s)\n", admin.Username, admin.Role)
}
