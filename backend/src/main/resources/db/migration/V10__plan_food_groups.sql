-- Grupos de alimentos por plan. Reemplaza el enum global FoodGroup.
-- Cada plan define sus propios grupos; los planes existentes se pueblan en V11.
CREATE TABLE plan_food_groups (
    id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_id       BIGINT      NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    name          VARCHAR(60) NOT NULL,
    abbreviation  VARCHAR(10) NOT NULL,
    display_order SMALLINT    NOT NULL,
    color         VARCHAR(7)
);

CREATE INDEX idx_pfg_plan_id ON plan_food_groups(plan_id);
