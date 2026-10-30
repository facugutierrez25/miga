-- V15 usó LOWER(abbreviation) como fallback para grupos sin mapeo conocido.
-- Esto producía valores inválidos (ej. 'pan', 'hue', 'dul') que el intérprete
-- no puede resolver contra el catálogo estándar.
-- Esta migración asigna la clave correcta donde existe mapeo, o NULL en caso contrario.

UPDATE plan_food_groups
SET clave = CASE abbreviation
    WHEN 'PRO' THEN 'proteinas'
    WHEN 'CER' THEN 'cereales_tuberculos'
    WHEN 'PAN' THEN 'panificados'
    WHEN 'VER' THEN 'verduras'
    WHEN 'FRU' THEN 'frutas'
    WHEN 'LAC' THEN 'lacteos'
    WHEN 'HUE' THEN 'huevos'
    WHEN 'GRA' THEN 'aceites_grasas'
    WHEN 'DUL' THEN 'dulces'
    ELSE NULL
END
WHERE clave NOT IN ('proteinas','cereales_tuberculos','panificados','verduras',
                    'frutas','lacteos','huevos','aceites_grasas','dulces')
   OR clave IS NULL;
