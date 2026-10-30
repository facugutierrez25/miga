package uy.miga.intake;

import org.junit.jupiter.api.Test;
import uy.miga.plans.PlanVersionCreated;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class PlanVersionListenerTest {
    @Test
    void movesMappedMealsAndClearsUnmappedGroupsOnlyForEventDateAndUser() {
        FoodEntryRepository repository = mock(FoodEntryRepository.class);
        LocalDate today = LocalDate.now();
        FoodEntry mapped = new FoodEntry(1L, "user", 10L, today, "food", 1.0, "u", 20L);
        FoodEntry missingGroup = new FoodEntry(1L, "user", 10L, today, "food", 1.0, "u", 99L);
        FoodEntry missingMeal = new FoodEntry(1L, "user", 99L, today, "food", 1.0, "u", 20L);
        when(repository.findByUserIdAndDateOrderByIdAsc(1L, today))
            .thenReturn(List.of(mapped, missingGroup, missingMeal));

        new PlanVersionListener(repository).moveTodayEntries(new PlanVersionCreated(1L, 2L, 3L,
            Map.of(20L, 21L), Map.of(10L, 11L), today));

        assertThat(mapped.getMealId()).isEqualTo(11L);
        assertThat(mapped.getFoodGroupId()).isEqualTo(21L);
        assertThat(missingGroup.getMealId()).isEqualTo(11L);
        assertThat(missingGroup.getFoodGroupId()).isNull();
        assertThat(missingMeal.getMealId()).isEqualTo(99L);
        assertThat(missingMeal.getFoodGroupId()).isEqualTo(20L);
        verify(repository).findByUserIdAndDateOrderByIdAsc(1L, today);
        verifyNoMoreInteractions(repository);
    }
}
