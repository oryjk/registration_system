package authhttp

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharedhttp "github.com/oryjk/registration_system/registration_system_go/internal/shared/http"
)

const actorContextKey = "authenticated_actor"

type Middleware struct {
	tokens ports.TokenService
}

func NewMiddleware(tokens ports.TokenService) Middleware {
	return Middleware{tokens: tokens}
}

func (m Middleware) RequireUser() gin.HandlerFunc {
	return m.require(sharedauth.ActorUser)
}

func (m Middleware) RequireAdmin() gin.HandlerFunc {
	return m.require(sharedauth.ActorAdmin)
}

func ActorFromContext(c *gin.Context) (sharedauth.Actor, bool) {
	value, exists := c.Get(actorContextKey)
	if !exists {
		return sharedauth.Actor{}, false
	}
	actor, ok := value.(sharedauth.Actor)
	return actor, ok
}

func (m Middleware) require(kind sharedauth.ActorKind) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := bearerToken(c.GetHeader("Authorization"))
		if !ok {
			abort(c, http.StatusUnauthorized, "unauthorized")
			return
		}
		actor, err := m.tokens.Parse(c.Request.Context(), token)
		if err != nil {
			abort(c, http.StatusUnauthorized, "unauthorized")
			return
		}
		if actor.Kind != kind {
			abort(c, http.StatusForbidden, "forbidden")
			return
		}
		c.Set(actorContextKey, actor)
		c.Next()
	}
}

func bearerToken(header string) (string, bool) {
	prefix, token, ok := strings.Cut(header, " ")
	if !ok || !strings.EqualFold(prefix, "Bearer") || strings.TrimSpace(token) == "" {
		return "", false
	}
	return strings.TrimSpace(token), true
}

func abort(c *gin.Context, status int, message string) {
	c.AbortWithStatusJSON(status, sharedhttp.Response[any]{
		Code:    status,
		Message: message,
		Data:    nil,
	})
}
