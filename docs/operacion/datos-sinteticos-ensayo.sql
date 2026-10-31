-- Datos sintéticos para el ensayo de restauración (sin datos reales).
INSERT INTO users (email, password_hash, role, email_verified)
SELECT 'ensayo-' || g || '@example.test', 'hash', 'PATIENT', true FROM generate_series(1, 50) g;

INSERT INTO plans (user_id, created_at, updated_at, is_current)
SELECT id, now() - interval '30 days', now(), true FROM users WHERE email LIKE 'ensayo-%';

INSERT INTO plan_food_groups (plan_id, name, abbreviation, display_order, clave, uid)
SELECT p.id, g.name, g.abbr, g.ord, g.clave, gen_random_uuid()
FROM plans p
CROSS JOIN (VALUES ('Proteínas', 'PRO', 1, 'proteinas'), ('Cereales', 'CER', 2, 'cereales_tuberculos'),
                   ('Grasas', 'GRA', 3, 'aceites_grasas')) AS g(name, abbr, ord, clave);

INSERT INTO meals (plan_id, name, display_order)
SELECT id, 'Desayuno', 1 FROM plans;

INSERT INTO meal_portions (meal_id, food_group_id, portions)
SELECT m.id, g.id, 1 FROM meals m JOIN plan_food_groups g ON g.plan_id = m.plan_id;

INSERT INTO food_rules (alcance, plan_id, user_id, alimento, tipo, food_group_id, cantidad_por_porcion, unidad, uid)
SELECT 'USUARIO', p.id, p.user_id, 'pan sintético', 'NORMAL', g.id, 30, 'g', gen_random_uuid()
FROM plans p JOIN plan_food_groups g ON g.plan_id = p.id AND g.abbreviation = 'CER';

INSERT INTO meal_notes (user_id, fecha, meal_id, texto, plan_id)
SELECT p.user_id, CURRENT_DATE - d, m.id, '2 pan sintético', p.id
FROM plans p JOIN meals m ON m.plan_id = p.id CROSS JOIN generate_series(0, 13) d;

INSERT INTO food_entries (user_id, user_email, meal_id, date, food, quantity, unit, food_group_id,
                          meal_note_id, origen, porciones, applied_rule, occurrence_id)
SELECT n.user_id, u.email, n.meal_id, n.fecha, 'pan sintético', 2, 'u', g.id,
       n.id, 'REGLA', 2, '30 g de pan sintético = 1 porción de Cereales', gen_random_uuid()
FROM meal_notes n
JOIN users u ON u.id = n.user_id
JOIN plan_food_groups g ON g.plan_id = n.plan_id AND g.abbreviation = 'CER';

INSERT INTO plan_habits (plan_id, name, habit_type, unit, daily_goal, uid)
SELECT id, 'Agua', 'CANTIDAD', 'lt', 2, gen_random_uuid() FROM plans;

INSERT INTO habit_logs (user_id, plan_habit_id, habit_uid, log_date, value)
SELECT p.user_id, h.id, h.uid, CURRENT_DATE - d, 1.5
FROM plans p JOIN plan_habits h ON h.plan_id = p.id CROSS JOIN generate_series(0, 13) d;
