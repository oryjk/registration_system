.PHONY: fmt check test integration-test run migrate

fmt:
	cargo fmt

check:
	cargo check

test:
	cargo test -- --nocapture

integration-test:
	@test -n "$$TEST_DATABASE_URL" || (echo "TEST_DATABASE_URL is required for database integration tests" && exit 1)
	DATABASE_URL="$$TEST_DATABASE_URL" cargo test -- --ignored --nocapture

run:
	cargo run

migrate:
	sqlx migrate run
