-- Migra las equivalencias de usuario a food_rules (alcance USUARIO) y elimina
-- la tabla equivalences. La API /api/v1/equivalences sigue funcionando igual,
-- ahora leyendo desde food_rules.

INSERT INTO food_rules (
    alcance, plan_id, user_id, alimento,
    cantidad_por_porcion, unidad, food_group_id, porcion_por_defecto
)
SELECT
    'USUARIO',
    e.plan_id,
    u.id,
    e.food,
    e.quantity,
    e.unit,
    e.food_group_id,
    1.0
FROM equivalences e
JOIN users u ON u.email = e.user_email;

DROP TABLE equivalences;
