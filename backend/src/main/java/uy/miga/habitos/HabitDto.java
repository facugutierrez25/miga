package uy.miga.habitos;

import java.math.BigDecimal;
import java.util.UUID;

record HabitDto(
    Long id,
    String name,
    String habitType,
    String unit,
    BigDecimal dailyGoal,
    BigDecimal step,
    String period,
    boolean countsFlexibleMeals,
    short displayOrder,
    // Identidad estable del hábito entre versiones del plan; el id cambia en cada versión.
    UUID uid
) {}
