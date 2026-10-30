-- Elimina las columnas food_group varchar ahora reemplazadas por food_group_id.
ALTER TABLE meal_portions  DROP COLUMN food_group;
ALTER TABLE food_entries   DROP COLUMN food_group;
ALTER TABLE equivalences   DROP COLUMN food_group;
