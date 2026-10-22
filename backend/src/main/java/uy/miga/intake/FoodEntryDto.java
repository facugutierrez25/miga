package uy.miga.intake;

import uy.miga.plans.FoodGroup;

record FoodEntryDto(Long id, Long mealId, String food, Double quantity, String unit, FoodGroup foodGroup, boolean consumed) {}
