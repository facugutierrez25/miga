package uy.miga.intake;

import java.math.BigDecimal;

record FoodEntryDto(Long id, Long mealId, String food, Double quantity, String unit, Long foodGroupId, boolean consumed, BigDecimal portions) {}
