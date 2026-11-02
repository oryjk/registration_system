package venuehttp

import (
	"context"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/venue/domain"
)

type QueryUseCase interface {
	Suggestions(context.Context, sharedauth.Actor, int) ([]domain.Venue, error)
	Map(context.Context, sharedauth.Actor) ([]domain.Venue, error)
	ListForAdmin(context.Context, sharedauth.Actor) ([]domain.Venue, error)
}

type ImageUseCase interface {
	Upload(context.Context, sharedauth.Actor, []byte) (string, error)
	SetImage(context.Context, sharedauth.Actor, string, string) error
}

type Handler struct {
	venues QueryUseCase
	images ImageUseCase
}

func NewHandler(venues QueryUseCase, images ...ImageUseCase) *Handler {
	handler := &Handler{venues: venues}
	if len(images) > 0 {
		handler.images = images[0]
	}
	return handler
}

func (h *Handler) RegisterUserRoutes(group *gin.RouterGroup) {
	group.GET("/venues/suggestions", h.Suggestions)
	group.GET("/venues/map", h.Map)
}

func (h *Handler) RegisterAdminRoutes(group *gin.RouterGroup) {
	group.GET("/venues", h.List)
	group.POST("/venues/images", h.UploadImage)
	group.PUT("/venues/image", h.SetImage)
}

type VenueResponse struct {
	Location   string   `json:"location"`
	Latitude   *float64 `json:"latitude"`
	Longitude  *float64 `json:"longitude"`
	UseCount   int64    `json:"use_count"`
	LastUsedAt string   `json:"last_used_at"`
	ImageURL   string   `json:"image_url"`
}

func (h *Handler) Suggestions(c *gin.Context) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	limit, err := strconv.Atoi(c.Query("limit"))
	if err != nil {
		limit = 0
	}
	items, err := h.venues.Suggestions(c.Request.Context(), actor, limit)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	writeVenues(c, items)
}

func (h *Handler) Map(c *gin.Context) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	items, err := h.venues.Map(c.Request.Context(), actor)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	writeVenues(c, items)
}

func (h *Handler) List(c *gin.Context) {
	actor, ok := adminActor(c)
	if !ok {
		return
	}
	items, err := h.venues.ListForAdmin(c.Request.Context(), actor)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	writeVenues(c, items)
}

func writeVenues(c *gin.Context, items []domain.Venue) {
	responses := make([]VenueResponse, 0, len(items))
	for _, item := range items {
		lastUsedAt := ""
		if !item.LastUsedAt.IsZero() {
			lastUsedAt = item.LastUsedAt.UTC().Format(time.RFC3339)
		}
		responses = append(responses, VenueResponse{
			Location: item.Name, Latitude: item.Latitude, Longitude: item.Longitude,
			UseCount: item.UseCount, LastUsedAt: lastUsedAt, ImageURL: item.ImageURL,
		})
	}
	sharedhttpapi.WriteSuccess(c, responses)
}

type SetImageRequest struct {
	Location string `json:"location" binding:"required"`
	ImageURL string `json:"image_url"`
}

func (h *Handler) SetImage(c *gin.Context) {
	actor, ok := adminActor(c)
	if !ok {
		return
	}
	var request SetImageRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "球场名称不能为空"))
		return
	}
	if err := h.images.SetImage(c.Request.Context(), actor, request.Location, request.ImageURL); err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, gin.H{"location": request.Location, "image_url": request.ImageURL})
}

func adminActor(c *gin.Context) (sharedauth.Actor, bool) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok || !actor.IsAdmin() {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return sharedauth.Actor{}, false
	}
	return actor, true
}
