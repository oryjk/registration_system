package ports

type PasswordService interface {
	Compare(hash, password string) error
	Hash(password string) (string, error)
}
