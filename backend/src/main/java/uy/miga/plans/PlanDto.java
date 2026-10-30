package uy.miga.plans;

import java.util.List;

record PlanDto(List<PlanFoodGroupDto> foodGroups, List<MealDto> meals, Long version, java.time.LocalDate createdAt) {}
