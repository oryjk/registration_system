-- +goose Up
-- 收款日期独立于流水录入时间，使用扩展表保持基础流水结构不变。
-- 当前 sqlc 会将查询源文件中的 SELECT * 展开为显式列名；兼容性核对应检查
-- 生成的 SQL 与部署镜像，不能仅凭源文件中的星号推断扫描列数风险。
CREATE TABLE team_fund_credit_receipts (
    transaction_id BIGINT PRIMARY KEY REFERENCES team_fund_transactions(id) ON DELETE CASCADE,
    received_on DATE NOT NULL
);

-- +goose Down
-- 仅回滚收款日期元数据，余额和原始流水保持完整。
DROP TABLE team_fund_credit_receipts;
