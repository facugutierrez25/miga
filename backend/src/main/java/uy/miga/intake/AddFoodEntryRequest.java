package uy.miga.intake;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import uy.miga.plans.FoodGroup;

record AddFoodEntryRequest(
    @NotBlank @Size(max = 120) String food,
    @NotNull  @Positive        Double quantity,
    @NotBlank @Size(max = 20)  String unit,
    @NotNull                   FoodGroup foodGroup
) {}
