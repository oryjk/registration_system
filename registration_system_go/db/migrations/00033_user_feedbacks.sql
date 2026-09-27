-- 用户主动提交的产品建议，与打赏支付完全解耦。
CREATE TABLE IF NOT EXISTS user_feedbacks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_feedbacks_content_not_blank CHECK (length(btrim(content)) > 0),
    CONSTRAINT user_feedbacks_content_length CHECK (char_length(content) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_user_feedbacks_created_at
    ON user_feedbacks (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_feedbacks_user_id_created_at
    ON user_feedbacks (user_id, created_at DESC);
