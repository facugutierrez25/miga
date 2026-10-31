-- #175: grupos, reglas y hábitos editables a mano (ver docs/adr/0005).
-- Agrega identidad estable entre versiones del plan, vínculo de ajustes sobre el
-- catálogo, snapshot de la regla aplicada en cada ítem y archivo de hábitos.

-- Verificación previa: no se fusionan ni se borran duplicados en silencio.
DO $$
DECLARE
    dup_abbr  BIGINT;
    dup_clave BIGINT;
BEGIN
    SELECT COUNT(*) INTO dup_abbr FROM (
        SELECT plan_id FROM plan_food_groups
        GROUP BY plan_id, abbreviation HAVING COUNT(*) > 1
    ) t;
    SELECT COUNT(*) INTO dup_clave FROM (
        SELECT plan_id FROM plan_food_groups
        WHERE clave IS NOT NULL
        GROUP BY plan_id, clave HAVING COUNT(*) > 1
    ) t;
    IF dup_abbr > 0 OR dup_clave > 0 THEN
        RAISE EXCEPTION 'V26 abortada: % plan(es) con abreviatura repetida y % con clave repetida en plan_food_groups',
            dup_abbr, dup_clave;
    END IF;
END;
$$;

-- ── plan_food_groups ─────────────────────────────────────────────────────────
-- Las versiones de un mismo usuario comparten uid por abreviatura.
ALTER TABLE plan_food_groups ADD COLUMN uid UUID;

UPDATE plan_food_groups g
SET uid = md5(p.user_id || ':group:' || g.abbreviation)::uuid
FROM plans p
WHERE p.id = g.plan_id;

ALTER TABLE plan_food_groups
    ALTER COLUMN uid SET NOT NULL,
    ALTER COLUMN uid SET DEFAULT gen_random_uuid(),
    ADD CONSTRAINT uq_plan_food_groups_abbreviation UNIQUE (plan_id, abbreviation),
    ADD CONSTRAINT uq_plan_food_groups_uid UNIQUE (plan_id, uid);

CREATE UNIQUE INDEX uq_plan_food_groups_clave
    ON plan_food_groups (plan_id, clave) WHERE clave IS NOT NULL;

-- ── food_rules ───────────────────────────────────────────────────────────────
ALTER TABLE food_rules
    ADD COLUMN uid UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN overrides_rule_uid UUID;

CREATE UNIQUE INDEX uq_food_rules_plan_uid ON food_rules (plan_id, uid) WHERE plan_id IS NOT NULL;
CREATE UNIQUE INDEX uq_food_rules_global_uid ON food_rules (uid) WHERE plan_id IS NULL;

-- Un grupo referenciado por una regla no se borra: se rechaza en lugar de dejar
-- una regla NORMAL sin grupo.
ALTER TABLE food_rules
    DROP CONSTRAINT food_rules_food_group_id_fkey,
    ADD CONSTRAINT food_rules_food_group_id_fkey
        FOREIGN KEY (food_group_id) REFERENCES plan_food_groups(id) ON DELETE RESTRICT;

-- ── plan_habits / habit_logs ─────────────────────────────────────────────────
ALTER TABLE plan_habits
    ADD COLUMN uid UUID,
    ADD COLUMN archived_at TIMESTAMPTZ;

UPDATE plan_habits h
SET uid = md5(p.user_id || ':habit:' || lower(h.name))::uuid
FROM plans p
WHERE p.id = h.plan_id;

-- Dentro de un mismo plan dos hábitos con igual nombre no comparten uid.
UPDATE plan_habits h
SET uid = gen_random_uuid()
WHERE EXISTS (
    SELECT 1 FROM plan_habits o
    WHERE o.plan_id = h.plan_id AND o.uid = h.uid AND o.id < h.id
);

ALTER TABLE plan_habits
    ALTER COLUMN uid SET NOT NULL,
    ALTER COLUMN uid SET DEFAULT gen_random_uuid(),
    ADD CONSTRAINT uq_plan_habits_uid UNIQUE (plan_id, uid);

ALTER TABLE habit_logs ADD COLUMN habit_uid UUID;

UPDATE habit_logs l
SET habit_uid = h.uid
FROM plan_habits h
WHERE h.id = l.plan_habit_id;

ALTER TABLE habit_logs ALTER COLUMN habit_uid SET NOT NULL;

CREATE INDEX idx_habit_logs_user_uid_date ON habit_logs (user_id, habit_uid, log_date);

-- ── food_entries ─────────────────────────────────────────────────────────────
-- applied_rule: texto de la regla al interpretar (los ítems viejos quedan en NULL).
-- occurrence_id: común a los componentes de una misma mención de un compuesto.
ALTER TABLE food_entries
    ADD COLUMN applied_rule  TEXT,
    ADD COLUMN occurrence_id UUID;
