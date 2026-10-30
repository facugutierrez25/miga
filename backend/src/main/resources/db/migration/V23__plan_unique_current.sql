DO $$
DECLARE
    duplicates BIGINT;
BEGIN
    SELECT COUNT(*) INTO duplicates
    FROM (
        SELECT user_id, COUNT(*) AS cnt
        FROM plans
        WHERE is_current = true
        GROUP BY user_id
        HAVING COUNT(*) > 1
    ) t;
    IF duplicates > 0 THEN
        RAISE EXCEPTION 'V23 abortada: existen % usuario(s) con más de un plan activo', duplicates;
    END IF;
END;
$$;

CREATE UNIQUE INDEX idx_plans_one_current_per_user ON plans (user_id) WHERE is_current = true;
