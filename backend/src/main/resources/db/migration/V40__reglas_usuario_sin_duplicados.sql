-- Comparar con la fila de menor id antes de modificar referencias.
CREATE TEMP TABLE user_rule_replacements ON COMMIT DROP AS
SELECT r.id, r.uid, r.user_id, r.plan_id, k.uid AS kept_uid
FROM (
    SELECT *, first_value(id) OVER (
        PARTITION BY user_id, plan_id, lower(btrim(alimento)) ORDER BY id
    ) AS kept_id
    FROM food_rules
    WHERE alcance = 'USUARIO'
) r
JOIN food_rules k ON k.id = r.kept_id
WHERE r.id <> k.id
  AND ROW(r.alimento, r.sinonimos, r.tipo, r.standard_group_key, r.food_group_id,
          r.componentes, r.cantidad_por_porcion, r.unidad, r.porcion_por_defecto,
          r.overrides_rule_uid)
      IS NOT DISTINCT FROM
      ROW(k.alimento, k.sinonimos, k.tipo, k.standard_group_key, k.food_group_id,
          k.componentes, k.cantidad_por_porcion, k.unidad, k.porcion_por_defecto,
          k.overrides_rule_uid);

-- La igualdad de contenido permite conservar el ajuste del catálogo.
UPDATE food_rules r
SET overrides_rule_uid = d.kept_uid
FROM user_rule_replacements d
WHERE r.overrides_rule_uid = d.uid
  AND r.plan_id IS NOT DISTINCT FROM d.plan_id;

-- Revocar undo del duplicado y de la regla conservada: representan varias creaciones.
-- El uid puede corresponder a una versión posterior al plan de la comida.
UPDATE food_entries e
SET resolved_rule_uid = NULL
WHERE EXISTS (
    SELECT 1 FROM user_rule_replacements d
    WHERE e.resolved_rule_uid IN (d.uid, d.kept_uid) AND d.user_id = e.user_id
);

DELETE FROM food_rules r
USING user_rule_replacements d
WHERE r.id = d.id;

DO $$
DECLARE
    divergent_groups bigint;
BEGIN
    SELECT count(*) INTO divergent_groups
    FROM (
        SELECT user_id, plan_id, lower(btrim(alimento))
        FROM food_rules
        WHERE alcance = 'USUARIO'
        GROUP BY user_id, plan_id, lower(btrim(alimento))
        HAVING count(*) > 1
    ) duplicates;

    IF divergent_groups > 0 THEN
        RAISE EXCEPTION 'V40 abortada: % grupos de reglas de usuario duplicadas con contenido divergente requieren reconciliación manual.', divergent_groups;
    END IF;
END $$;

CREATE UNIQUE INDEX uq_food_rules_user_plan_food
    ON food_rules (user_id, plan_id, lower(btrim(alimento)))
    WHERE alcance = 'USUARIO';
