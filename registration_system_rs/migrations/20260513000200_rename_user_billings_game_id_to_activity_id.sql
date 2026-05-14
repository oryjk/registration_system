DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'rs_user_billings'
          AND column_name = 'game_id'
    ) THEN
        ALTER TABLE rs_user_billings RENAME COLUMN game_id TO activity_id;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_user_billings_activity'
    ) THEN
        ALTER TABLE rs_user_billings
            DROP CONSTRAINT fk_user_billings_activity;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.idx_user_billings_game') IS NOT NULL
       AND to_regclass('public.idx_user_billings_activity_id') IS NULL THEN
        ALTER INDEX idx_user_billings_game RENAME TO idx_user_billings_activity_id;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_user_billings_activity'
    ) THEN
        ALTER TABLE rs_user_billings
            ADD CONSTRAINT fk_user_billings_activity
            FOREIGN KEY (activity_id) REFERENCES rs_activity (id) ON DELETE RESTRICT;
    END IF;
END $$;
