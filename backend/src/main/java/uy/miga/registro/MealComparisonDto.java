package uy.miga.registro;

import java.util.List;

record MealComparisonDto(Long mealId, List<GroupStatusDto> groups) {}
