package apidocs_test

import (
	"context"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/gin-gonic/gin"
	apidocs "github.com/oryjk/registration_system/registration_system_go/docs"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/bootstrap"
	matchhttp "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/http"
	paymenthttp "github.com/oryjk/registration_system/registration_system_go/internal/payment/adapters/http"
	systemhttp "github.com/oryjk/registration_system/registration_system_go/internal/system/adapters/http"
	teamhttp "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/http"
	userhttp "github.com/oryjk/registration_system/registration_system_go/internal/user/adapters/http"
	wallethttp "github.com/oryjk/registration_system/registration_system_go/internal/wallet/adapters/http"
)

func TestOpenAPIIsValidAndMatchesGinRoutes(t *testing.T) {
	document := loadDocument(t)
	if document.OpenAPI != "3.0.3" {
		t.Fatalf("OpenAPI version=%q, want 3.0.3", document.OpenAPI)
	}

	documented := openAPIOperations(document)
	registered := ginOperations(completeRouter())
	missing := operationDifference(registered, documented)
	extra := operationDifference(documented, registered)
	if len(missing) != 0 || len(extra) != 0 {
		t.Fatalf("OpenAPI route mismatch\nmissing: %v\nextra: %v", missing, extra)
	}
	if len(documented) != 76 {
		t.Fatalf("documented operations=%d, want 76", len(documented))
	}
}

func TestOpenAPISecurityMatchesPublicAndProtectedRoutes(t *testing.T) {
	document := loadDocument(t)
	for _, route := range []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/health"},
		{method: http.MethodPost, path: "/api/v1/app/auth/wechat/login"},
		{method: http.MethodGet, path: "/api/v1/app/test-auth/users"},
		{method: http.MethodPost, path: "/api/v1/app/test-auth/login"},
		{method: http.MethodPost, path: "/api/v1/admin/auth/login"},
		{method: http.MethodPost, path: "/api/v1/webhooks/wechat-pay"},
	} {
		if operationRequiresBearer(operation(t, document, route.method, route.path)) {
			t.Fatalf("%s %s must be public", route.method, route.path)
		}
	}

	for _, route := range []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/api/v1/app/users/me"},
		{method: http.MethodPost, path: "/api/v1/app/matches"},
		{method: http.MethodGet, path: "/api/v1/admin/auth/me"},
		{method: http.MethodPost, path: "/api/v1/app/payments/recharge-orders"},
		{method: http.MethodGet, path: "/api/v1/app/wallet"},
		{method: http.MethodGet, path: "/api/v1/admin/payments/orders"},
		{method: http.MethodGet, path: "/api/v1/admin/wallets/{user_id}"},
	} {
		if !operationRequiresBearer(operation(t, document, route.method, route.path)) {
			t.Fatalf("%s %s must require bearerAuth", route.method, route.path)
		}
	}

	for _, route := range []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/api/v1/app/test-auth/users"},
		{method: http.MethodPost, path: "/api/v1/app/test-auth/login"},
	} {
		description := operation(t, document, route.method, route.path).Description
		if !strings.Contains(description, "development/test") || !strings.Contains(description, "ENABLE_H5_TEST_LOGIN=true") {
			t.Fatalf("%s %s must document its environment gate", route.method, route.path)
		}
	}
}

func TestOpenAPIHomeMatchSchemasRequirePublicationMode(t *testing.T) {
	document := loadDocument(t)
	for _, schemaName := range []string{"UserHomeActionMatch", "UserHomeEndedMatch"} {
		schemaRef := document.Components.Schemas[schemaName]
		if schemaRef == nil || schemaRef.Value == nil {
			t.Fatalf("OpenAPI schema %s is missing", schemaName)
		}
		if _, found := schemaRef.Value.Properties["publication_mode"]; !found {
			t.Fatalf("OpenAPI schema %s is missing publication_mode", schemaName)
		}
		required := false
		for _, name := range schemaRef.Value.Required {
			if name == "publication_mode" {
				required = true
				break
			}
		}
		if !required {
			t.Fatalf("OpenAPI schema %s must require publication_mode", schemaName)
		}
	}
}

func loadDocument(t *testing.T) *openapi3.T {
	t.Helper()
	document, err := openapi3.NewLoader().LoadFromData(apidocs.OpenAPI)
	if err != nil {
		t.Fatalf("load OpenAPI: %v", err)
	}
	if err := document.Validate(context.Background()); err != nil {
		t.Fatalf("validate OpenAPI: %v", err)
	}
	return document
}

func completeRouter() *gin.Engine {
	middleware := authhttp.NewMiddleware(nil)
	return bootstrap.NewRouter(bootstrap.Dependencies{
		AuthMiddleware:     &middleware,
		UserAuth:           authhttp.NewHandler(nil),
		TestAuth:           authhttp.NewTestHandler(nil, 37),
		AdminAuth:          authhttp.NewAdminHandler(nil),
		UserProfiles:       userhttp.NewHandler(nil),
		AppUsers:           userhttp.NewAppHandler(nil, nil, ""),
		H5TestLoginEnabled: true,
		Teams:              teamhttp.NewHandler(nil, nil),
		AppTeams:           teamhttp.NewAppHandler(nil, nil),
		AppTeamManage:      teamhttp.NewAppManageHandler(nil),
		UserMatches:        matchhttp.NewUserHandler(nil, nil, nil),
		UserRegistrations:  matchhttp.NewUserRegistrationHandler(nil),
		AdminMatches:       matchhttp.NewAdminHandler(nil, nil),
		TeamApplications:   matchhttp.NewTeamApplicationHandler(nil),
		Payments:           paymenthttp.NewHandler(nil),
		Wallets:            wallethttp.NewHandler(nil),
		SystemRuntime:      systemhttp.NewHandler(nil),
	})
}

func openAPIOperations(document *openapi3.T) map[string]struct{} {
	operations := map[string]struct{}{}
	for path, item := range document.Paths.Map() {
		for method := range item.Operations() {
			operations[operationKey(method, path)] = struct{}{}
		}
	}
	return operations
}

func ginOperations(router *gin.Engine) map[string]struct{} {
	parameter := regexp.MustCompile(`:([A-Za-z0-9_]+)`)
	operations := map[string]struct{}{}
	for _, route := range router.Routes() {
		if strings.HasPrefix(route.Path, "/api/docs") || strings.HasPrefix(route.Path, "/uploads") {
			continue
		}
		path := parameter.ReplaceAllString(route.Path, `{$1}`)
		operations[operationKey(route.Method, path)] = struct{}{}
	}
	return operations
}

func operationKey(method, path string) string {
	return strings.ToUpper(method) + " " + path
}

func operationDifference(left, right map[string]struct{}) []string {
	difference := make([]string, 0)
	for item := range left {
		if _, found := right[item]; !found {
			difference = append(difference, item)
		}
	}
	sort.Strings(difference)
	return difference
}

func operation(t *testing.T, document *openapi3.T, method, path string) *openapi3.Operation {
	t.Helper()
	item := document.Paths.Value(path)
	if item == nil {
		t.Fatalf("OpenAPI path %s is missing", path)
	}
	operation := item.Operations()[method]
	if operation == nil {
		t.Fatalf("OpenAPI operation %s %s is missing", method, path)
	}
	return operation
}

func operationRequiresBearer(operation *openapi3.Operation) bool {
	if operation.Security == nil {
		return false
	}
	for _, requirement := range *operation.Security {
		if _, found := requirement["bearerAuth"]; found {
			return true
		}
	}
	return false
}
