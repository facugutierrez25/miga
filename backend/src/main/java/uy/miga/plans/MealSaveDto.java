package uy.miga.plans;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.time.LocalTime;
import java.util.List;

record MealSaveDto(
    @NotBlank @Size(max = 100) String name,
    LocalTime suggestedTime,
    int displayOrder,
    @NotEmpty @Valid List<MealPortionInput> portions
) {}
