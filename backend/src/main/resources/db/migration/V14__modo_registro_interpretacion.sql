-- Agrega modo_registro y margen_porciones al plan, y crea la tabla
-- de reglas de interpretación para el registro en texto libre (v2).

ALTER TABLE plans
    ADD COLUMN modo_registro    VARCHAR(20)  NOT NULL DEFAULT 'PORCIONES',
    ADD COLUMN margen_porciones NUMERIC(3,2) NOT NULL DEFAULT 0.20;

CREATE TABLE interpretation_rules (
    id            BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_id       BIGINT       NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    pattern       VARCHAR(200) NOT NULL,
    food_group_id BIGINT       NOT NULL REFERENCES plan_food_groups(id) ON DELETE CASCADE,
    default_unit  VARCHAR(20),
    confidence    NUMERIC(3,2) NOT NULL DEFAULT 1.00
);

CREATE INDEX idx_ir_plan_id ON interpretation_rules(plan_id);
