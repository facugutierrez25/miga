package uy.miga.equivalences;

import uy.miga.plans.FoodGroup;

record EquivalenceDto(Long id, FoodGroup foodGroup, String food, Double quantity, Unit unit) {}
