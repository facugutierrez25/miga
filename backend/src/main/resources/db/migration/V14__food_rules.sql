-- margen_porciones: absoluto en porciones (default 0.5 = media porción de tolerancia).
-- food_rules unifica equivalencias de usuario y catálogo global en un solo modelo.

ALTER TABLE plans
    ADD COLUMN modo_registro    VARCHAR(20)  NOT NULL DEFAULT 'PORCIONES',
    ADD COLUMN margen_porciones NUMERIC(5,2) NOT NULL DEFAULT 0.5;

CREATE TABLE food_rules (
    id                   BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alcance              VARCHAR(10)  NOT NULL DEFAULT 'PLAN',
    plan_id              BIGINT       REFERENCES plans(id) ON DELETE CASCADE,
    user_id              BIGINT       REFERENCES users(id) ON DELETE CASCADE,
    alimento             VARCHAR(200) NOT NULL,
    sinonimos            TEXT[],
    tipo                 VARCHAR(20)  NOT NULL DEFAULT 'NORMAL',
    standard_group_key   VARCHAR(50),
    food_group_id        BIGINT       REFERENCES plan_food_groups(id) ON DELETE SET NULL,
    componentes          JSONB,
    cantidad_por_porcion NUMERIC(8,3),
    unidad               VARCHAR(20),
    porcion_por_defecto  NUMERIC(8,3) NOT NULL DEFAULT 1.0,
    CONSTRAINT chk_food_rules_alcance CHECK (alcance IN ('GLOBAL','PLAN','USUARIO')),
    CONSTRAINT chk_food_rules_tipo    CHECK (tipo IN ('NORMAL','COMPUESTO','LIBRE','FLEXIBLE','NO_CUENTA'))
);

CREATE INDEX idx_food_rules_plan   ON food_rules(plan_id)  WHERE plan_id IS NOT NULL;
CREATE INDEX idx_food_rules_user   ON food_rules(user_id)  WHERE user_id IS NOT NULL;
CREATE INDEX idx_food_rules_global ON food_rules(alcance)  WHERE alcance = 'GLOBAL';
