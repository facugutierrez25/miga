CREATE INDEX IF NOT EXISTS idx_food_entries_meal ON food_entries (meal_id);
CREATE INDEX IF NOT EXISTS idx_food_entries_group ON food_entries (food_group_id);
CREATE INDEX IF NOT EXISTS idx_meal_notes_user_meal ON meal_notes (user_id, meal_id);
CREATE INDEX IF NOT EXISTS idx_plans_user_created ON plans (user_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_uid ON habit_logs (habit_uid);
CREATE INDEX IF NOT EXISTS idx_habit_logs_plan_habit ON habit_logs (plan_habit_id);
