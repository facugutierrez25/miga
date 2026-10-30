package uy.miga.intake;

import org.junit.jupiter.api.Test;
import uy.miga.plans.PlanNotFoundException;
import uy.miga.plans.PlanService;
import uy.miga.plans.PlanVersionConflictException;
import uy.miga.reglas.ReglaService;
import uy.miga.users.UserService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class FoodEntryServiceTest {
    private final FoodEntryRepository repository = mock(FoodEntryRepository.class);
    private final PlanService plans = mock(PlanService.class);
    private final UserService users = mock(UserService.class);
    private final FoodEntryService service = new FoodEntryService(repository, users, plans, mock(ReglaService.class));

    @Test
    void manualEntryLocksThenRejectsOldMeal() {
        LocalDate date = LocalDate.now();
        when(users.findUserIdByEmail("user")).thenReturn(1L);
        when(plans.mealBelongsToUser(10L, 1L)).thenReturn(true);
        when(plans.getPlanIdForDate(1L, date)).thenReturn(20L);
        when(plans.getMealIds(20L)).thenReturn(List.of(11L));

        assertThatThrownBy(() -> service.addEntry("user", 10L, date, "food", 1.0, "u", 7L))
            .isInstanceOf(PlanVersionConflictException.class);
        var order = inOrder(plans);
        order.verify(plans).lockCurrentPlan(1L);
        order.verify(plans).mealBelongsToUser(10L, 1L);
        verifyNoInteractions(repository);
    }

    @Test
    void historicalManualEntryToleratesMissingCurrentPlan() {
        LocalDate date = LocalDate.now().minusDays(1);
        when(users.findUserIdByEmail("user")).thenReturn(1L);
        when(plans.lockCurrentPlan(1L)).thenThrow(new PlanNotFoundException());
        when(plans.mealBelongsToUser(10L, 1L)).thenReturn(true);
        when(plans.getPlanIdForDate(1L, date)).thenReturn(19L);
        when(plans.getMealIds(19L)).thenReturn(List.of(10L));
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        assertThat(service.addEntry("user", 10L, date, "food", 1.0, "u", null).mealId()).isEqualTo(10L);
    }

    @Test
    void detachGroupPreservesRecordedPortionsAndRuleSnapshot() {
        FoodEntry entry = new FoodEntry(1L, "user", 10L, LocalDate.now(), "food", 2.0, "u", 7L);
        entry.setPorciones(new BigDecimal("3"));
        entry.setAppliedRule("snapshot");
        when(repository.findByFoodGroupId(7L)).thenReturn(List.of(entry));

        new FoodEntryFacade(repository).detachGroup(7L);

        assertThat(entry.getFoodGroupId()).isNull();
        assertThat(entry.getPorciones()).isEqualByComparingTo("3");
        assertThat(entry.getAppliedRule()).isEqualTo("snapshot");
        verify(repository).flush();
    }
}
