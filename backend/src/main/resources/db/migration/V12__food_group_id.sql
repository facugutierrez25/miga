-- Agrega food_group_id (FK a plan_food_groups) en meal_portions, food_entries
-- y equivalences.  Rellena los datos desde la columna food_group varchar existente.

-- ── meal_portions ────────────────────────────────────────────────────────────
ALTER TABLE meal_portions
    DROP CONSTRAINT meal_portions_meal_id_food_group_key,
    ADD COLUMN food_group_id BIGINT REFERENCES plan_food_groups(id);

UPDATE meal_portions mp
SET food_group_id = pfg.id
FROM meals m
JOIN plans p         ON p.id  = m.plan_id
JOIN plan_food_groups pfg ON pfg.plan_id = p.id
WHERE mp.meal_id = m.id
  AND (
      (mp.food_group = 'PROTEINS'   AND pfg.abbreviation = 'PRO')
   OR (mp.food_group = 'GRAINS'     AND pfg.abbreviation = 'CER')
   OR (mp.food_group = 'FRUITS'     AND pfg.abbreviation = 'FRU')
   OR (mp.food_group = 'DAIRY'      AND pfg.abbreviation = 'LAC')
   OR (mp.food_group = 'FATS'       AND pfg.abbreviation = 'GRA')
   OR (mp.food_group = 'VEGETABLES' AND pfg.abbreviation = 'VER')
  );

ALTER TABLE meal_portions
    ALTER COLUMN food_group_id SET NOT NULL,
    ADD CONSTRAINT meal_portions_meal_id_food_group_id_key UNIQUE (meal_id, food_group_id);

-- ── food_entries ─────────────────────────────────────────────────────────────
ALTER TABLE food_entries
    ADD COLUMN food_group_id BIGINT REFERENCES plan_food_groups(id);

UPDATE food_entries fe
SET food_group_id = pfg.id
FROM meals m
JOIN plans p         ON p.id  = m.plan_id
JOIN plan_food_groups pfg ON pfg.plan_id = p.id
WHERE fe.meal_id = m.id
  AND (
      (fe.food_group = 'PROTEINS'   AND pfg.abbreviation = 'PRO')
   OR (fe.food_group = 'GRAINS'     AND pfg.abbreviation = 'CER')
   OR (fe.food_group = 'FRUITS'     AND pfg.abbreviation = 'FRU')
   OR (fe.food_group = 'DAIRY'      AND pfg.abbreviation = 'LAC')
   OR (fe.food_group = 'FATS'       AND pfg.abbreviation = 'GRA')
   OR (fe.food_group = 'VEGETABLES' AND pfg.abbreviation = 'VER')
  );

DELETE FROM food_entries WHERE food_group_id IS NULL;

ALTER TABLE food_entries
    ALTER COLUMN food_group_id SET NOT NULL;

-- ── equivalences ─────────────────────────────────────────────────────────────
-- Primero vinculamos cada equivalencia al plan más reciente del usuario.
ALTER TABLE equivalences
    ADD COLUMN plan_id BIGINT REFERENCES plans(id);

UPDATE equivalences e
SET plan_id = (
    SELECT p.id
    FROM plans p
    JOIN users u ON u.id = p.user_id
    WHERE u.email = e.user_email
    ORDER BY p.created_at DESC
    LIMIT 1
);

ALTER TABLE equivalences
    ALTER COLUMN plan_id SET NOT NULL;

-- Ahora resolvemos el food_group_id desde el plan asociado.
ALTER TABLE equivalences
    ADD COLUMN food_group_id BIGINT REFERENCES plan_food_groups(id);

UPDATE equivalences e
SET food_group_id = pfg.id
FROM plan_food_groups pfg
WHERE pfg.plan_id = e.plan_id
  AND (
      (e.food_group = 'PROTEINS'   AND pfg.abbreviation = 'PRO')
   OR (e.food_group = 'GRAINS'     AND pfg.abbreviation = 'CER')
   OR (e.food_group = 'FRUITS'     AND pfg.abbreviation = 'FRU')
   OR (e.food_group = 'DAIRY'      AND pfg.abbreviation = 'LAC')
   OR (e.food_group = 'FATS'       AND pfg.abbreviation = 'GRA')
   OR (e.food_group = 'VEGETABLES' AND pfg.abbreviation = 'VER')
  );

ALTER TABLE equivalences
    ALTER COLUMN food_group_id SET NOT NULL;
