-- Tipo y origen de la regla que se aplicó a cada ítem registrado.
-- rule_source: PLAN (regla del plan), CATALOGO (catálogo base) o USUARIO (corrección de la persona).
ALTER TABLE food_entries ADD COLUMN rule_type VARCHAR(12);
ALTER TABLE food_entries ADD COLUMN rule_source VARCHAR(10);
ALTER TABLE food_entries ADD CONSTRAINT chk_food_entries_rule_type
    CHECK (rule_type IN ('NORMAL', 'COMPUESTO', 'LIBRE', 'FLEXIBLE', 'NO_CUENTA', 'PREGUNTAR') OR rule_type IS NULL);
ALTER TABLE food_entries ADD CONSTRAINT chk_food_entries_rule_source
    CHECK (rule_source IN ('PLAN', 'CATALOGO', 'USUARIO') OR rule_source IS NULL);

-- Lo ya guardado que se puede deducir sin reinterpretar: correcciones y respuestas.
UPDATE food_entries SET rule_source = 'USUARIO' WHERE origen = 'USUARIO';
UPDATE food_entries SET rule_type = 'PREGUNTAR', rule_source = 'PLAN' WHERE origen = 'RESPUESTA';
