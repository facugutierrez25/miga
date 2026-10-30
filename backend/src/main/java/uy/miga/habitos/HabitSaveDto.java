package uy.miga.habitos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

record HabitSaveDto(
    @NotBlank String name,
    @NotNull String habitType,
    String unit,
    BigDecimal dailyGoal,
    BigDecimal step,
    String period,
    short displayOrder
) {}
