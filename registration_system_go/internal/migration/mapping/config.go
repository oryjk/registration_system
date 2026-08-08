package mapping

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/google/uuid"
)

type Config struct {
	values map[EntityKey]string
}

type configFile struct {
	LegacyMySQL    *mysqlMappings    `json:"legacy_mysql,omitempty"`
	LegacyPostgres *postgresMappings `json:"legacy_postgres,omitempty"`
}

type mysqlMappings struct {
	Users       map[string]string `json:"users,omitempty"`
	Teams       map[string]string `json:"teams,omitempty"`
	Memberships map[string]string `json:"memberships,omitempty"`
}

type postgresMappings struct {
	Users         map[string]string `json:"users,omitempty"`
	Matches       map[string]string `json:"matches,omitempty"`
	Registrations map[string]string `json:"registrations,omitempty"`
}

func LoadConfig(path string) (Config, error) {
	file, err := os.Open(path)
	if err != nil {
		return Config{}, fmt.Errorf("open mapping config: %w", err)
	}
	defer file.Close()
	decoder := json.NewDecoder(file)
	decoder.DisallowUnknownFields()
	var raw configFile
	if err := decoder.Decode(&raw); err != nil {
		return Config{}, fmt.Errorf("decode mapping config: %w", err)
	}
	if err := ensureJSONEOF(decoder); err != nil {
		return Config{}, err
	}
	config := Config{values: make(map[EntityKey]string)}
	if raw.LegacyMySQL != nil {
		if err := config.addBigIntMappings(SourceLegacyMySQL, EntityUser, raw.LegacyMySQL.Users); err != nil {
			return Config{}, err
		}
		if err := config.addBigIntMappings(SourceLegacyMySQL, EntityTeam, raw.LegacyMySQL.Teams); err != nil {
			return Config{}, err
		}
		if err := config.addBigIntMappings(SourceLegacyMySQL, EntityMembership, raw.LegacyMySQL.Memberships); err != nil {
			return Config{}, err
		}
	}
	if raw.LegacyPostgres != nil {
		if err := config.addBigIntMappings(SourceLegacyPostgres, EntityUser, raw.LegacyPostgres.Users); err != nil {
			return Config{}, err
		}
		if err := config.addUUIDMappings(SourceLegacyPostgres, EntityMatch, raw.LegacyPostgres.Matches); err != nil {
			return Config{}, err
		}
		if err := config.addUUIDMappings(SourceLegacyPostgres, EntityRegistration, raw.LegacyPostgres.Registrations); err != nil {
			return Config{}, err
		}
	}
	return config, nil
}

func EmptyConfig() Config { return Config{values: make(map[EntityKey]string)} }

func (c Config) Lookup(source SourceSystem, entity EntityType, sourceID string) (string, bool) {
	value, ok := c.values[EntityKey{SourceSystem: source, EntityType: entity, SourceID: strings.TrimSpace(sourceID)}]
	return value, ok
}

func (c *Config) addBigIntMappings(source SourceSystem, entity EntityType, values map[string]string) error {
	for sourceID, targetID := range values {
		parsed, err := strconv.ParseInt(strings.TrimSpace(targetID), 10, 64)
		if strings.TrimSpace(sourceID) == "" || err != nil || parsed <= 0 {
			return fmt.Errorf("invalid %s %s mapping %q -> %q", source, entity, sourceID, targetID)
		}
		c.values[EntityKey{SourceSystem: source, EntityType: entity, SourceID: strings.TrimSpace(sourceID)}] = strconv.FormatInt(parsed, 10)
	}
	return nil
}

func (c *Config) addUUIDMappings(source SourceSystem, entity EntityType, values map[string]string) error {
	for sourceID, targetID := range values {
		parsed, err := uuid.Parse(strings.TrimSpace(targetID))
		if strings.TrimSpace(sourceID) == "" || err != nil {
			return fmt.Errorf("invalid %s %s mapping %q -> %q", source, entity, sourceID, targetID)
		}
		c.values[EntityKey{SourceSystem: source, EntityType: entity, SourceID: strings.TrimSpace(sourceID)}] = parsed.String()
	}
	return nil
}

func ensureJSONEOF(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); err == io.EOF {
		return nil
	}
	return fmt.Errorf("mapping config must contain one JSON object")
}
