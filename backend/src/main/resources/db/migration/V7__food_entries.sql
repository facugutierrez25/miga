CREATE TABLE food_entries (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    meal_id    BIGINT       NOT NULL,
    date       DATE         NOT NULL,
    food       VARCHAR(120) NOT NULL,
    quantity   FLOAT8       NOT NULL,
    unit       VARCHAR(20)  NOT NULL,
    dish_id    BIGINT
);

CREATE INDEX idx_food_entries_user_date ON food_entries (user_email, date);
