CREATE TABLE plan_habits (
    id          BIGSERIAL PRIMARY KEY,
    plan_id     BIGINT NOT NULL REFERENCES plans(id),
    name        VARCHAR(100) NOT NULL,
    habit_type  VARCHAR(20) NOT NULL,
    unit        VARCHAR(40),
    daily_goal  NUMERIC(8, 2),
    step        NUMERIC(8, 2) DEFAULT 1,
    period      VARCHAR(10) NOT NULL DEFAULT 'DIA',
    display_order SMALLINT NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE habit_logs (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL,
    plan_habit_id  BIGINT NOT NULL REFERENCES plan_habits(id),
    log_date       DATE NOT NULL,
    value          NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, plan_habit_id, log_date)
);

CREATE INDEX idx_habit_logs_user_date ON habit_logs (user_id, log_date);
CREATE INDEX idx_plan_habits_plan ON plan_habits (plan_id);
