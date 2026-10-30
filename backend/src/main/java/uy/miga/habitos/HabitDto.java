package uy.miga.habitos;

import java.math.BigDecimal;

record HabitDto(
    Long id,
    String name,
    String habitType,
    String unit,
    BigDecimal dailyGoal,
    BigDecimal step,
    String period,
    short displayOrder
) {}
