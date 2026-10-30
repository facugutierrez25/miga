-- Extiende food_entries para soportar el registro por nota de texto libre.
-- Las entradas del formulario anterior quedan con origen NULL y se muestran como ítems sueltos.

ALTER TABLE food_entries
    ADD COLUMN meal_note_id   BIGINT      REFERENCES meal_notes(id) ON DELETE SET NULL,
    ADD COLUMN texto_original VARCHAR(500),
    ADD COLUMN origen         VARCHAR(10),
    ADD COLUMN supuesto       BOOLEAN,
    ADD COLUMN porciones      NUMERIC(8,3),
    ADD CONSTRAINT chk_food_entries_origen CHECK (origen IN ('REGLA','USUARIO','IA') OR origen IS NULL);

CREATE INDEX idx_food_entries_note ON food_entries(meal_note_id) WHERE meal_note_id IS NOT NULL;
