-- 球队管理员关联表
-- 超级管理员可将某个普通管理员指定为负责管理特定球队
CREATE TABLE rs_admin_team_assignment (
    id         BIGSERIAL PRIMARY KEY,
    admin_id   BIGINT      NOT NULL,
    team_id    VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_admin_team UNIQUE (admin_id, team_id)
);

CREATE INDEX idx_ata_admin_id ON rs_admin_team_assignment(admin_id);
CREATE INDEX idx_ata_team_id  ON rs_admin_team_assignment(team_id);
