ALTER TABLE food_rules ADD COLUMN maybe_flexible BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO food_rules (alcance, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto, maybe_flexible)
SELECT 'GLOBAL', 'jamon cocido', ARRAY['jamón cocido','jamón','jamon']::TEXT[], 'NORMAL', 'proteinas', 60, 'g', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM food_rules WHERE alcance = 'GLOBAL' AND alimento = 'jamon cocido');

INSERT INTO food_rules (alcance, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto, maybe_flexible)
SELECT 'GLOBAL', 'jamon crudo', ARRAY['jamón crudo']::TEXT[], 'NORMAL', 'proteinas', 60, 'g', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM food_rules WHERE alcance = 'GLOBAL' AND alimento = 'jamon crudo');

INSERT INTO food_rules (alcance, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto, maybe_flexible)
SELECT 'GLOBAL', 'salame', ARRAY[]::TEXT[], 'NORMAL', 'proteinas', 60, 'g', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM food_rules WHERE alcance = 'GLOBAL' AND alimento = 'salame');

INSERT INTO food_rules (alcance, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto, maybe_flexible)
SELECT 'GLOBAL', 'mortadela', ARRAY[]::TEXT[], 'NORMAL', 'proteinas', 60, 'g', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM food_rules WHERE alcance = 'GLOBAL' AND alimento = 'mortadela');

INSERT INTO food_rules (alcance, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto, maybe_flexible)
SELECT 'GLOBAL', 'panceta', ARRAY[]::TEXT[], 'NORMAL', 'proteinas', 60, 'g', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM food_rules WHERE alcance = 'GLOBAL' AND alimento = 'panceta');

INSERT INTO food_rules (alcance, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto, maybe_flexible)
SELECT 'GLOBAL', 'pancho', ARRAY['panchos','frankfurter']::TEXT[], 'NORMAL', 'proteinas', 90, 'g', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM food_rules WHERE alcance = 'GLOBAL' AND alimento = 'pancho');

INSERT INTO food_rules (alcance, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto, maybe_flexible)
SELECT 'GLOBAL', 'chorizo', ARRAY[]::TEXT[], 'NORMAL', 'proteinas', 90, 'g', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM food_rules WHERE alcance = 'GLOBAL' AND alimento = 'chorizo');

INSERT INTO food_rules (alcance, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto, maybe_flexible)
SELECT 'GLOBAL', 'morcilla', ARRAY[]::TEXT[], 'NORMAL', 'proteinas', 90, 'g', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM food_rules WHERE alcance = 'GLOBAL' AND alimento = 'morcilla');

INSERT INTO food_rules (alcance, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto, maybe_flexible)
SELECT 'GLOBAL', 'papas fritas', ARRAY['papa frita']::TEXT[], 'NORMAL', 'cereales_tuberculos', 90, 'g', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM food_rules WHERE alcance = 'GLOBAL' AND alimento = 'papas fritas');

INSERT INTO food_rules (alcance, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto, maybe_flexible)
SELECT 'GLOBAL', 'milanesa frita', ARRAY[]::TEXT[], 'NORMAL', 'proteinas', 90, 'g', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM food_rules WHERE alcance = 'GLOBAL' AND alimento = 'milanesa frita');

INSERT INTO food_rules (alcance, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto, maybe_flexible)
SELECT 'GLOBAL', 'nuggets', ARRAY['nugget','nuggets de pollo']::TEXT[], 'NORMAL', 'proteinas', 90, 'g', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM food_rules WHERE alcance = 'GLOBAL' AND alimento = 'nuggets');

INSERT INTO food_rules (alcance, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto, maybe_flexible)
SELECT 'GLOBAL', 'bastones de pollo', ARRAY['sticks de pollo','baston de pollo']::TEXT[], 'NORMAL', 'proteinas', 90, 'g', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM food_rules WHERE alcance = 'GLOBAL' AND alimento = 'bastones de pollo');

INSERT INTO food_rules (alcance, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto, maybe_flexible)
SELECT 'GLOBAL', 'empanadas fritas', ARRAY['empanada frita']::TEXT[], 'NORMAL', 'cereales_tuberculos', 90, 'g', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM food_rules WHERE alcance = 'GLOBAL' AND alimento = 'empanadas fritas');

INSERT INTO food_rules (alcance, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto, maybe_flexible)
SELECT 'GLOBAL', 'asado', ARRAY[]::TEXT[], 'NORMAL', 'proteinas', 90, 'g', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM food_rules WHERE alcance = 'GLOBAL' AND alimento = 'asado');

INSERT INTO food_rules (alcance, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto, maybe_flexible)
SELECT 'GLOBAL', 'vacio', ARRAY['vacío']::TEXT[], 'NORMAL', 'proteinas', 90, 'g', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM food_rules WHERE alcance = 'GLOBAL' AND alimento = 'vacio');

INSERT INTO food_rules (alcance, alimento, sinonimos, tipo, standard_group_key, cantidad_por_porcion, unidad, porcion_por_defecto, maybe_flexible)
SELECT 'GLOBAL', 'matambre', ARRAY[]::TEXT[], 'NORMAL', 'proteinas', 90, 'g', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM food_rules WHERE alcance = 'GLOBAL' AND alimento = 'matambre');

UPDATE food_rules SET maybe_flexible = TRUE WHERE alcance = 'GLOBAL' AND alimento IN ('jamon cocido','jamon crudo','salame','mortadela','panceta','pancho','chorizo','morcilla','papas fritas','milanesa frita','nuggets','bastones de pollo','empanadas fritas','asado','vacio','matambre');
