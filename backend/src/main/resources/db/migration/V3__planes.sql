CREATE TABLE plans (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT NOT NULL UNIQUE REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version    BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE meals (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_id        BIGINT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    name           VARCHAR(100) NOT NULL,
    suggested_time TIME,
    display_order  INT NOT NULL,
    UNIQUE (plan_id, display_order)
);

CREATE TABLE meal_portions (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    meal_id    BIGINT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    food_group VARCHAR(20) NOT NULL,
    portions   NUMERIC(3,1) NOT NULL CHECK (portions >= 0 AND portions <= 10),
    UNIQUE (meal_id, food_group)
);
