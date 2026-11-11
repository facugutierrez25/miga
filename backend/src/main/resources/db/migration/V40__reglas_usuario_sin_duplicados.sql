CREATE TEMP TABLE user_rule_replacements ON COMMIT DROP AS
SELECT id, uid, user_id, plan_id,
       first_value(uid) OVER (
           PARTITION BY user_id, plan_id, lower(btrim(alimento)) ORDER BY id
       ) AS kept_uid
FROM food_rules
WHERE alcance = 'USUARIO';

UPDATE food_rules r
SET overrides_rule_uid = d.kept_uid
FROM user_rule_replacements d
WHERE r.overrides_rule_uid = d.uid
  AND r.plan_id IS NOT DISTINCT FROM d.plan_id;

-- Una resolución histórica puede guardar una regla de una versión posterior a la comida.
UPDATE food_entries e
SET resolved_rule_uid = (
    SELECT d.kept_uid
    FROM user_rule_replacements d
    WHERE d.uid = e.resolved_rule_uid AND d.user_id = e.user_id
    ORDER BY (d.plan_id = (SELECT m.plan_id FROM meals m WHERE m.id = e.meal_id)) DESC NULLS LAST,
             d.id DESC
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 FROM user_rule_replacements d
    WHERE d.uid = e.resolved_rule_uid AND d.user_id = e.user_id AND d.uid <> d.kept_uid
);

DELETE FROM food_rules r
USING user_rule_replacements d
WHERE r.id = d.id AND d.uid <> d.kept_uid;

CREATE UNIQUE INDEX uq_food_rules_user_plan_food
    ON food_rules (user_id, plan_id, lower(btrim(alimento)))
    WHERE alcance = 'USUARIO';
