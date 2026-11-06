-- Días de la semana en que toca cada comida, como máscara de bits (lunes = 1, martes = 2, … domingo = 64).
-- NULL significa todos los días.
ALTER TABLE meals ADD COLUMN weekdays SMALLINT;
ALTER TABLE meals ADD CONSTRAINT chk_meals_weekdays CHECK (weekdays BETWEEN 1 AND 126 OR weekdays IS NULL);
