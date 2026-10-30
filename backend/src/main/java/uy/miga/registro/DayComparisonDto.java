package uy.miga.registro;

import java.time.LocalDate;
import java.util.List;

record DayComparisonDto(LocalDate date, List<MealComparisonDto> meals) {}
