package uy.miga.plans;

import java.util.List;

record MealSummaryDto(
    String name,
    List<MealPortionDto> portions
) {}
