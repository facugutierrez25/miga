package uy.miga.plans;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record PlanReadData(Long id, LocalDate start, LocalDate end, String mode, BigDecimal margin,
                           List<PlanFoodGroupDto> groups, List<MealData> meals) {
    public record MealData(Long id, String name, List<MealPortionSummary> portions) {}
    public BigDecimal totalGoal() {
        if ("LIBRE".equals(mode)) return BigDecimal.ZERO;
        return meals.stream().flatMap(m -> m.portions().stream()).map(MealPortionSummary::portions)
            .filter(p -> p != null && p.signum() > 0).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
