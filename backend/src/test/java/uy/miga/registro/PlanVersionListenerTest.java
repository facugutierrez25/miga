package uy.miga.registro;

import org.junit.jupiter.api.Test;
import uy.miga.plans.PlanVersionCreated;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class PlanVersionListenerTest {
    @Test
    void movesOnlyOldPlanNotesWithMatchingMeal() {
        MealNoteRepository repository = mock(MealNoteRepository.class);
        LocalDate today = LocalDate.now();
        MealNote mapped = note(2L, 10L);
        MealNote missingMeal = note(2L, 99L);
        MealNote otherPlan = note(4L, 10L);
        when(repository.findByUserIdAndDate(1L, today)).thenReturn(List.of(mapped, missingMeal, otherPlan));

        new PlanVersionListener(repository).moveTodayNotes(new PlanVersionCreated(1L, 2L, 3L,
            Map.of(), Map.of(10L, 11L), today));

        assertThat(mapped.getPlanId()).isEqualTo(3L);
        assertThat(mapped.getMealId()).isEqualTo(11L);
        assertThat(missingMeal.getPlanId()).isEqualTo(2L);
        assertThat(missingMeal.getMealId()).isEqualTo(99L);
        assertThat(otherPlan.getPlanId()).isEqualTo(4L);
        assertThat(otherPlan.getMealId()).isEqualTo(10L);
    }

    private MealNote note(Long planId, Long mealId) {
        MealNote note = new MealNote();
        note.setPlanId(planId);
        note.setMealId(mealId);
        return note;
    }
}
