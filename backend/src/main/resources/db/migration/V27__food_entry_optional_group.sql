-- Un ítem trasladado puede no tener grupo equivalente en la versión nueva.
ALTER TABLE food_entries ALTER COLUMN food_group_id DROP NOT NULL;
