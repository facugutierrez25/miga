package uy.miga.plans;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

record PlanSaveDto(
    @NotEmpty @Valid List<MealSaveDto> meals
) {}
