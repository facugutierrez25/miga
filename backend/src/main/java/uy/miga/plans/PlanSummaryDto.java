package uy.miga.plans;

import java.time.LocalDate;
import java.util.List;

record PlanSummaryDto(
    LocalDate createdAt,
    LocalDate supersededAt,
    int mealCount,
    List<PlanFoodGroupDto> foodGroups,
    List<MealSummaryDto> meals
) {}
