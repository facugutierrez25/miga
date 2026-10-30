package uy.miga.plans;

import java.time.LocalTime;
import java.util.List;

record MealDto(Long id, String name, LocalTime suggestedTime, int displayOrder, List<MealPortionDto> portions) {}
