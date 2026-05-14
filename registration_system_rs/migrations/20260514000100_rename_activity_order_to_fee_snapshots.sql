ALTER TABLE IF EXISTS rs_activity_order
    RENAME TO rs_activity_fee_snapshots;

ALTER TABLE IF EXISTS rs_activity_fee_snapshots
    RENAME CONSTRAINT uk_activity_order_activity TO uk_activity_fee_snapshots_activity;

ALTER TABLE IF EXISTS rs_activity_fee_snapshots
    RENAME CONSTRAINT fk_activity_order_activity TO fk_activity_fee_snapshots_activity;
