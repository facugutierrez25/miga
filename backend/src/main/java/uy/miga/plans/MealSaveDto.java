package uy.miga.plans;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalTime;
import java.util.List;

record MealSaveDto(
    @NotBlank @Size(max = 100) String name,
    LocalTime suggestedTime,
    int displayOrder,
    @NotEmpty @Valid List<MealPortionInput> portions,
    // Días ISO (1 = lunes … 7 = domingo); null o vacío = todos los días.
    @Size(max = 7) List<@NotNull @Min(1) @Max(7) Integer> weekdays
) {
    MealSaveDto(String name, LocalTime suggestedTime, int displayOrder, List<MealPortionInput> portions) {
        this(name, suggestedTime, displayOrder, portions, null);
    }
}
