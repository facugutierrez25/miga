package uy.miga.habitos;

import jakarta.validation.constraints.*;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

record HabitSaveDto(
    @NotBlank @Size(max = 100, message = "El nombre admite hasta 100 caracteres.") String name,
    @NotNull String habitType,
    @Size(max = 40, message = "La unidad admite hasta 40 caracteres.") String unit,
    @PositiveOrZero(message = "La meta no puede ser negativa.") @DecimalMax(value = "100000", message = "La meta admite hasta 100000.") BigDecimal dailyGoal,
    @Positive(message = "El paso debe ser positivo.") @DecimalMax(value = "100000", message = "El paso admite hasta 100000.") BigDecimal step,
    String period,
    Boolean countsFlexibleMeals,
    short displayOrder
) {}
