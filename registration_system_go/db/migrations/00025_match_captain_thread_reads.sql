-- +goose Up
-- 队长留言的阅读进度：每个串的每个参与者各自记录已读到的时刻，
-- 未读数 = 串内对方发送且晚于该时刻的消息数。
CREATE TABLE match_captain_thread_reads (
    thread_id UUID NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (thread_id, user_id)
);

-- +goose Down
DROP TABLE IF EXISTS match_captain_thread_reads;
