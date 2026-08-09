package order

import "testing"

func TestGeneratorProducesWechatCompatibleUniqueOrderNumbers(t *testing.T) {
	generator := Generator{}
	first, second := generator.NewOrderNo(), generator.NewOrderNo()
	if first == second || len(first) == 0 || len(first) > 32 || first[0] != 'P' {
		t.Fatalf("order numbers %q %q", first, second)
	}
}
