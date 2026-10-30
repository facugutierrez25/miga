-- meal_notes guarda el texto libre que escribe el usuario por comida y fecha.
-- Es la fuente de verdad de lo que anotó; food_entries guarda el resultado interpretado.

CREATE TABLE meal_notes (
    id          BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fecha       DATE         NOT NULL,
    meal_id     BIGINT       NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    texto       TEXT         NOT NULL,
    actualizado TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, fecha, meal_id)
);

CREATE INDEX idx_meal_notes_user_fecha ON meal_notes(user_id, fecha);
