ALTER TABLE plans DROP CONSTRAINT plans_user_id_key;
ALTER TABLE plans ADD COLUMN is_current    BOOLEAN     NOT NULL DEFAULT TRUE;
ALTER TABLE plans ADD COLUMN superseded_at TIMESTAMPTZ;

CREATE INDEX idx_plans_user_current ON plans (user_id, is_current);
