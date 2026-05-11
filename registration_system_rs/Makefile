.PHONY: fmt check test run migrate

fmt:
	cargo fmt

check:
	cargo check

test:
	cargo test -- --nocapture

run:
	cargo run

migrate:
	sqlx migrate run
