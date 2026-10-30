package uy.miga.intake;

record FoodEntryDto(Long id, Long mealId, String food, Double quantity, String unit, Long foodGroupId, boolean consumed) {}
