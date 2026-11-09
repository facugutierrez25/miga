package uy.miga.plans;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.time.DayOfWeek;

public record PlanReadData(Long id, LocalDate start, LocalDate end, String mode, BigDecimal margin,
                           List<PlanFoodGroupDto> groups, List<MealData> meals) {
    // weekdays: días ISO en que toca la comida; null = todos los días.
    public record MealData(Long id, String name, List<MealPortionSummary> portions, List<Integer> weekdays) {
        public MealData(Long id, String name, List<MealPortionSummary> portions) {
            this(id, name, portions, null);
        }

        public boolean appliesOn(DayOfWeek day) {
            return weekdays == null || weekdays.isEmpty() || weekdays.contains(day.getValue());
        }
    }

    public BigDecimal totalGoal() {
        return totalGoal(null);
    }

    // Meta del día: solo suman las comidas que tocan ese día (null = todas).
    public BigDecimal totalGoal(DayOfWeek day) {
        if ("LIBRE".equals(mode)) return BigDecimal.ZERO;
        return meals.stream().filter(m -> day == null || m.appliesOn(day))
            .flatMap(m -> m.portions().stream()).map(MealPortionSummary::portions)
            .filter(p -> p != null && p.signum() > 0).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
