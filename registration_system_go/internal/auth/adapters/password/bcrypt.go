package password

import (
	"errors"

	"golang.org/x/crypto/bcrypt"
)

const minimumPasswordLength = 10

type Bcrypt struct{}

func (Bcrypt) Compare(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

func (Bcrypt) Hash(password string) (string, error) {
	if len(password) < minimumPasswordLength {
		return "", errors.New("password must contain at least 10 characters")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hash), err
}
