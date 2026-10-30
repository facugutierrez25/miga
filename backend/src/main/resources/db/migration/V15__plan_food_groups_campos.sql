-- Agrega campos de configuración por grupo: clave estándar, meta diaria,
-- y flags para grupos que se preguntan al usuario o son opcionales.

ALTER TABLE plan_food_groups
    ADD COLUMN clave            VARCHAR(50),
    ADD COLUMN meta_diaria      NUMERIC(8,3),
    ADD COLUMN preguntar_si_falta BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN opcional         BOOLEAN NOT NULL DEFAULT FALSE;

-- Poblar clave a partir de la abreviatura existente, usando el mapa estándar.
UPDATE plan_food_groups SET clave = CASE abbreviation
    WHEN 'PRO' THEN 'proteinas'
    WHEN 'CER' THEN 'cereales_tuberculos'
    WHEN 'FRU' THEN 'frutas'
    WHEN 'LAC' THEN 'lacteos'
    WHEN 'GRA' THEN 'aceites_grasas'
    WHEN 'VER' THEN 'verduras'
    ELSE LOWER(abbreviation)
END;
