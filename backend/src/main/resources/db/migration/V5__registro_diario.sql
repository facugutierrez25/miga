CREATE TABLE meal_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meal_id     BIGINT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    logged_date DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT meal_logs_unique UNIQUE (user_id, meal_id, logged_date)
);

CREATE INDEX idx_meal_logs_user_date ON meal_logs (user_id, logged_date);
