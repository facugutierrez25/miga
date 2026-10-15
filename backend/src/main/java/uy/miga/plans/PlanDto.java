package uy.miga.plans;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

record PlanDto(
    @NotEmpty @Valid List<MealDto> meals
) {}
