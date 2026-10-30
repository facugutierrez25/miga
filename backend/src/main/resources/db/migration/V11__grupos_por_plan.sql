-- Inserta los 6 grupos estándar para cada plan ya existente,
-- mapeando los valores del antiguo enum FoodGroup a grupos con nombre en español.
INSERT INTO plan_food_groups (plan_id, name, abbreviation, display_order)
SELECT p.id, g.nombre, g.abreviatura, g.orden
FROM plans p
CROSS JOIN (VALUES
    ('Proteínas'::VARCHAR(60), 'PRO'::VARCHAR(10), 1::SMALLINT),
    ('Cereales',               'CER',              2),
    ('Frutas',                 'FRU',              3),
    ('Lácteos',                'LAC',              4),
    ('Grasas',                 'GRA',              5),
    ('Verduras',               'VER',              6)
) AS g(nombre, abreviatura, orden);
