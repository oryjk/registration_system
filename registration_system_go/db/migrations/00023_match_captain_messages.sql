-- +goose Up
-- 比赛队长留言：用户向比赛主队队长发起的私信往来，仅发起人与队长/领队可见，
-- 小程序消息中心「留言」板块消费。
CREATE TABLE match_captain_messages (
    id UUID PRIMARY KEY,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    thread_owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT match_captain_messages_content_not_blank CHECK (BTRIM(content) <> '')
);

CREATE INDEX match_captain_messages_thread_idx ON match_captain_messages (match_id, thread_owner_user_id, created_at);
CREATE INDEX match_captain_messages_team_idx ON match_captain_messages (team_id, created_at);

-- +goose Down
DROP TABLE IF EXISTS match_captain_messages;
