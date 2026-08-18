package password

import "golang.org/x/crypto/bcrypt"

// Bcrypt 实现入队口令的哈希与校验；与登录密码不同，不强制最小长度（与旧 Rust 行为一致）。
type Bcrypt struct{}

func (Bcrypt) Hash(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hash), err
}

func (Bcrypt) Verify(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
