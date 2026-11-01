-- Conserva los colores válidos y completa los grupos estándar por clave.
DO $$
DECLARE
    palette text[] := ARRAY['#C0704A','#A8822E','#B5627A','#4F86B8','#8070B0','#4E8F6A','#368C91','#95715D','#6675A0','#AD5860'];
    plan_row record;
    group_row record;
    used text[];
    chosen text;
    group_count integer;
BEGIN
    UPDATE plan_food_groups SET color = CASE clave
        WHEN 'proteinas' THEN '#C0704A'
        WHEN 'cereales_tuberculos' THEN '#A8822E'
        WHEN 'frutas' THEN '#B5627A'
        WHEN 'lacteos' THEN '#4F86B8'
        WHEN 'aceites_grasas' THEN '#8070B0'
        WHEN 'verduras' THEN '#4E8F6A'
        ELSE color END
    WHERE color IS NULL AND clave IN ('proteinas', 'cereales_tuberculos', 'frutas', 'lacteos', 'aceites_grasas', 'verduras');

    FOR plan_row IN SELECT DISTINCT plan_id FROM plan_food_groups ORDER BY plan_id LOOP
        SELECT COALESCE(array_agg(upper(color)), ARRAY[]::text[]), count(*)
        INTO used, group_count FROM plan_food_groups
        WHERE plan_id = plan_row.plan_id AND upper(color) = ANY(palette);
        FOR group_row IN SELECT id FROM plan_food_groups
            WHERE plan_id = plan_row.plan_id AND (color IS NULL OR NOT (upper(color) = ANY(palette)))
            ORDER BY display_order, id LOOP
            SELECT c INTO chosen FROM unnest(palette) WITH ORDINALITY AS p(c, n)
                WHERE NOT (c = ANY(used)) ORDER BY n LIMIT 1;
            IF chosen IS NULL THEN
                chosen := palette[(group_count % cardinality(palette)) + 1];
            END IF;
            UPDATE plan_food_groups SET color = chosen WHERE id = group_row.id;
            used := array_append(used, chosen);
            group_count := group_count + 1;
        END LOOP;
    END LOOP;
END $$;
