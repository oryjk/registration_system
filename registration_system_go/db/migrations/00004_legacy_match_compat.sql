-- +goose Up
-- 放宽 offline_confirmed 模式约束，允许历史比赛引用真实客队或占位客队（如“待定”）。
-- 历史数据全部为线下已约比赛，部分有真实对手名、部分对手待定；
-- 为保留客队引用，offline_confirmed 不再强制 away_team_id 为空。
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_offline_fields_check;

ALTER TABLE matches ADD CONSTRAINT matches_offline_fields_check CHECK (
    (
        publication_mode = 'offline_confirmed'
        AND opponent_name IS NOT NULL
        AND BTRIM(opponent_name) <> ''
        AND opponent_state = 'no_recruitment'
    )
    OR
    (
        publication_mode <> 'offline_confirmed'
        AND opponent_name IS NULL
        AND opponent_state IN ('recruiting', 'confirmed')
    )
);

-- 新增 unknown 报名状态，承接历史 stand=0（未表态）数据。
ALTER TABLE match_registrations DROP CONSTRAINT IF EXISTS match_registrations_status_check;

ALTER TABLE match_registrations ADD CONSTRAINT match_registrations_status_check CHECK (
    status IN ('unknown', 'attending', 'leave', 'absent', 'cancelled')
);

-- +goose Down
ALTER TABLE match_registrations DROP CONSTRAINT IF EXISTS match_registrations_status_check;
ALTER TABLE match_registrations ADD CONSTRAINT match_registrations_status_check CHECK (
    status IN ('attending', 'leave', 'absent', 'cancelled')
);

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_offline_fields_check;
ALTER TABLE matches ADD CONSTRAINT matches_offline_fields_check CHECK (
    (
        publication_mode = 'offline_confirmed'
        AND opponent_name IS NOT NULL
        AND BTRIM(opponent_name) <> ''
        AND opponent_state = 'no_recruitment'
        AND away_team_id IS NULL
    )
    OR
    (
        publication_mode <> 'offline_confirmed'
        AND opponent_name IS NULL
        AND opponent_state IN ('recruiting', 'confirmed')
    )
);
