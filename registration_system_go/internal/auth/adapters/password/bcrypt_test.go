package password

import "testing"

func TestHashAcceptsSixCharacterPassword(t *testing.T) {
	hash, err := (Bcrypt{}).Hash("123456")
	if err != nil {
		t.Fatalf("hash six-character password: %v", err)
	}
	if err := (Bcrypt{}).Compare(hash, "123456"); err != nil {
		t.Fatalf("compare password: %v", err)
	}
}

func TestHashRejectsPasswordShorterThanSixCharacters(t *testing.T) {
	if _, err := (Bcrypt{}).Hash("12345"); err == nil {
		t.Fatal("expected short password to be rejected")
	}
}
