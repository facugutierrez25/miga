-- Completa los colores que faltan: los grupos estándar por clave y el resto con un color libre de la paleta.
DO $$
DECLARE
    palette text[] := ARRAY['#C0704A','#A8822E','#B5627A','#4F86B8','#8070B0','#4E8F6A','#368C91','#95715D','#6675A0','#AD5860'];
    plan_row record;
    group_row record;
    used text[];
    chosen text;
    group_count integer;
BEGIN
    -- Primero, un grupo sin color toma el que ya tiene el mismo grupo (uid) en otra versión del plan.
    UPDATE plan_food_groups g SET color = (
        SELECT o.color FROM plan_food_groups o
        WHERE o.uid = g.uid AND o.color IS NOT NULL AND o.id <> g.id
        ORDER BY o.plan_id LIMIT 1)
    WHERE g.color IS NULL AND EXISTS (
        SELECT 1 FROM plan_food_groups o WHERE o.uid = g.uid AND o.color IS NOT NULL AND o.id <> g.id);

    UPDATE plan_food_groups SET color = CASE clave
        WHEN 'proteinas' THEN '#C0704A'
        WHEN 'cereales_tuberculos' THEN '#A8822E'
        WHEN 'frutas' THEN '#B5627A'
        WHEN 'lacteos' THEN '#4F86B8'
        WHEN 'aceites_grasas' THEN '#8070B0'
        WHEN 'verduras' THEN '#4E8F6A'
        ELSE color END
    WHERE color IS NULL AND clave IN ('proteinas', 'cereales_tuberculos', 'frutas', 'lacteos', 'aceites_grasas', 'verduras');

    -- Solo se completan los grupos sin color: un color existente, aunque no sea de la paleta, se conserva.
    -- Los planes se recorren del más viejo al más nuevo y un grupo (por uid) reutiliza el color que ya
    -- recibió en otra versión, para que no cambie entre versiones del plan.
    FOR plan_row IN SELECT DISTINCT plan_id FROM plan_food_groups ORDER BY plan_id LOOP
        SELECT COALESCE(array_agg(upper(color)), ARRAY[]::text[]), count(*)
        INTO used, group_count FROM plan_food_groups
        WHERE plan_id = plan_row.plan_id AND color IS NOT NULL;
        FOR group_row IN SELECT id, uid FROM plan_food_groups
            WHERE plan_id = plan_row.plan_id AND color IS NULL
            ORDER BY display_order, id LOOP
            SELECT color INTO chosen FROM plan_food_groups
                WHERE uid = group_row.uid AND color IS NOT NULL AND id <> group_row.id
                ORDER BY plan_id LIMIT 1;
            IF chosen IS NULL THEN
                SELECT c INTO chosen FROM unnest(palette) WITH ORDINALITY AS p(c, n)
                    WHERE NOT (c = ANY(used)) ORDER BY n LIMIT 1;
            END IF;
            IF chosen IS NULL THEN
                chosen := palette[(group_count % cardinality(palette)) + 1];
            END IF;
            UPDATE plan_food_groups SET color = chosen WHERE id = group_row.id;
            used := array_append(used, upper(chosen));
            group_count := group_count + 1;
            chosen := NULL;
        END LOOP;
    END LOOP;
END $$;
