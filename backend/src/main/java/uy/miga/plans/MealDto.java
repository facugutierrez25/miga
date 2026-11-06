package uy.miga.plans;

import java.time.LocalTime;
import java.util.List;

// weekdays: días ISO (1 = lunes … 7 = domingo); null = todos los días.
record MealDto(Long id, String name, LocalTime suggestedTime, int displayOrder, List<MealPortionDto> portions,
               List<Integer> weekdays) {}
