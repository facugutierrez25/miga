ALTER TABLE food_entries DROP CONSTRAINT chk_food_entries_origen;
ALTER TABLE food_entries ADD CONSTRAINT chk_food_entries_origen
    CHECK (origen IN ('REGLA', 'USUARIO', 'IA', 'RESPUESTA') OR origen IS NULL);
