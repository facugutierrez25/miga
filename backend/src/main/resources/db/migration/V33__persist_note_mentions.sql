ALTER TABLE food_entries DROP CONSTRAINT chk_food_entries_origen;
ALTER TABLE food_entries ADD CONSTRAINT chk_food_entries_origen
    CHECK (origen IN ('REGLA', 'USUARIO', 'IA', 'RESPUESTA', 'MENTION', 'UNKNOWN') OR origen IS NULL);
ALTER TABLE food_entries ADD CONSTRAINT chk_food_entries_mention
    CHECK (origen NOT IN ('MENTION', 'UNKNOWN') OR (food_group_id IS NULL AND porciones IS NULL));

-- Las menciones sin grupo (MENTION) y no reconocidas (UNKNOWN) se guardan sin porciones;
-- una mención no reconocida puede ocupar toda la nota.
ALTER TABLE food_entries ALTER COLUMN food TYPE VARCHAR(10000);
ALTER TABLE food_entries ALTER COLUMN texto_original TYPE VARCHAR(10000);
