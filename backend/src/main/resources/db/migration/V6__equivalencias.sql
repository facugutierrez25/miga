CREATE TABLE equivalences (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    food_group VARCHAR(20)  NOT NULL,
    food       VARCHAR(120) NOT NULL,
    quantity   FLOAT8       NOT NULL,
    unit       VARCHAR(20)  NOT NULL
);

CREATE INDEX idx_equivalences_user ON equivalences (user_email);
