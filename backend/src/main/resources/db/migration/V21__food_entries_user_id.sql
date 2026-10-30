-- Agrega user_id a food_entries y lo respalda con FK a users.
-- El backfill resuelve el userId por email; si existe algún huérfano
-- (entrada sin usuario correspondiente), la migración falla con diagnóstico.

ALTER TABLE food_entries ADD COLUMN user_id BIGINT;

UPDATE food_entries e
SET    user_id = u.id
FROM   users u
WHERE  u.email = e.user_email;

DO $$
DECLARE
    orphans BIGINT;
BEGIN
    SELECT COUNT(*) INTO orphans FROM food_entries WHERE user_id IS NULL;
    IF orphans > 0 THEN
        RAISE EXCEPTION
            'V21 abortada: % entrada(s) en food_entries sin usuario correspondiente. '
            'Investigar y resolver antes de aplicar esta migración.', orphans;
    END IF;
END;
$$;

ALTER TABLE food_entries
    ALTER COLUMN user_id SET NOT NULL,
    ADD CONSTRAINT fk_food_entries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX idx_food_entries_user_id_date ON food_entries (user_id, date);
