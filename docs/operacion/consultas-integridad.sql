-- Consultas de integridad del ensayo: conteos y relaciones de negocio.
SELECT 'migracion' AS chequeo, max(installed_rank)::text AS valor FROM flyway_schema_history WHERE success
UNION ALL SELECT 'usuarios', count(*)::text FROM users
UNION ALL SELECT 'planes_vigentes', count(*)::text FROM plans WHERE is_current
UNION ALL SELECT 'usuarios_con_mas_de_un_plan_vigente', count(*)::text
  FROM (SELECT user_id FROM plans WHERE is_current GROUP BY user_id HAVING count(*) > 1) t
UNION ALL SELECT 'grupos', count(*)::text FROM plan_food_groups
UNION ALL SELECT 'reglas_usuario', count(*)::text FROM food_rules WHERE alcance = 'USUARIO'
UNION ALL SELECT 'reglas_con_grupo_inexistente', count(*)::text
  FROM food_rules r WHERE r.food_group_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM plan_food_groups g WHERE g.id = r.food_group_id)
UNION ALL SELECT 'notas', count(*)::text FROM meal_notes
UNION ALL SELECT 'notas_sin_plan', count(*)::text FROM meal_notes WHERE plan_id IS NULL
UNION ALL SELECT 'items', count(*)::text FROM food_entries
UNION ALL SELECT 'items_con_nota_inexistente', count(*)::text
  FROM food_entries e WHERE e.meal_note_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM meal_notes n WHERE n.id = e.meal_note_id)
UNION ALL SELECT 'porciones_totales', coalesce(sum(porciones), 0)::text FROM food_entries
UNION ALL SELECT 'registros_habitos', count(*)::text FROM habit_logs
UNION ALL SELECT 'registros_habito_sin_uid_valido', count(*)::text
  FROM habit_logs l WHERE NOT EXISTS (SELECT 1 FROM plan_habits h WHERE h.uid = l.habit_uid);
