package uy.miga.intake;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

record AddFoodEntryRequest(
    @NotBlank @Size(max = 100, message = "El alimento admite hasta 100 caracteres.") String food,
    @NotNull  @Positive        Double quantity,
    @NotBlank @Size(max = 20)  String unit,
    @NotNull                   Long foodGroupId
) {}
