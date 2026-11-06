package uy.miga.plans;

import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

class WeekdaysTest {
    @Test
    void roundTripsDaysAndTreatsEmptyOrAllAsEveryDay() {
        assertThat(Weekdays.toMask(List.of(1, 3, 5))).isEqualTo((short) 21);
        assertThat(Weekdays.toList((short) 21)).containsExactly(1, 3, 5);
        assertThat(Weekdays.toMask(List.of(7, 1, 1))).isEqualTo((short) 65);
        assertThat(Weekdays.toMask(null)).isNull();
        assertThat(Weekdays.toMask(List.of())).isNull();
        assertThat(Weekdays.toMask(List.of(1, 2, 3, 4, 5, 6, 7))).isNull();
        assertThat(Weekdays.toList(null)).isNull();
    }

    @Test
    void rejectsDaysOutOfRange() {
        assertThatThrownBy(() -> Weekdays.toMask(List.of(0))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Weekdays.toMask(List.of(8))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void mealDataAppliesOnlyOnItsDays() {
        var meal = new PlanReadData.MealData(1L, "Pre entreno", List.of(), List.of(2, 4));
        assertThat(meal.appliesOn(DayOfWeek.TUESDAY)).isTrue();
        assertThat(meal.appliesOn(DayOfWeek.MONDAY)).isFalse();
        assertThat(new PlanReadData.MealData(2L, "Cena", List.of()).appliesOn(DayOfWeek.SUNDAY)).isTrue();
    }
}
