package uy.miga.plans;

import java.util.List;
import java.time.LocalDate;

record PlanDto(List<PlanFoodGroupDto> foodGroups, List<MealDto> meals, Long version, LocalDate createdAt) {}
