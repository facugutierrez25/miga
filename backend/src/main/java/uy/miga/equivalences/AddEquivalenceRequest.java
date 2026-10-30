package uy.miga.equivalences;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

record AddEquivalenceRequest(
    @NotNull  Long planId,
    @NotNull  Long foodGroupId,
    @NotBlank @Size(max = 120) String food,
    @NotNull  @Positive        Double quantity,
    @NotNull                   Unit unit
) {}
