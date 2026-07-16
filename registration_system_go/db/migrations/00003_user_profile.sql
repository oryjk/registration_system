-- +goose Up
ALTER TABLE users
    ADD COLUMN real_name VARCHAR(120) NULL,
    ADD COLUMN phone_number VARCHAR(32) NULL;

-- +goose Down
ALTER TABLE users
    DROP COLUMN phone_number,
    DROP COLUMN real_name;
