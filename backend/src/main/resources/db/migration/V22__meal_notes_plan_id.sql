ALTER TABLE meal_notes ADD COLUMN plan_id BIGINT REFERENCES plans(id);

UPDATE meal_notes mn
SET plan_id = (
    SELECT p.id
    FROM plans p
    WHERE p.user_id = mn.user_id
      AND p.created_at::date <= mn.fecha
      AND (p.superseded_at IS NULL OR p.superseded_at::date >= mn.fecha)
    ORDER BY p.created_at DESC
    LIMIT 1
);

CREATE INDEX idx_meal_notes_plan_id ON meal_notes (plan_id);
