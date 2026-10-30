package uy.miga.habitos;

import org.junit.jupiter.api.Test;
import uy.miga.intake.FoodEntryFacade;
import uy.miga.plans.PlanService;
import uy.miga.users.UserService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class WeekServiceTest {
    @Test
    void habitLogLocksBeforeReadingHabitAndRejectsOldPlan() {
        PlanHabitRepository habits = mock(PlanHabitRepository.class);
        HabitLogRepository logs = mock(HabitLogRepository.class);
        PlanService plans = mock(PlanService.class);
        UserService users = mock(UserService.class);
        WeekService service = new WeekService(habits, logs, mock(FoodEntryFacade.class), plans, users);
        when(users.findUserIdByEmail("user")).thenReturn(1L);
        when(plans.getCurrentPlanId("user")).thenReturn(20L);
        PlanHabit habit = new PlanHabit();
        habit.setPlanId(19L);
        when(habits.findById(3L)).thenReturn(Optional.of(habit));

        assertThatThrownBy(() -> service.logHabit("user", 3L, LocalDate.now(), BigDecimal.ONE))
            .isInstanceOf(IllegalArgumentException.class);
        var order = inOrder(plans, habits);
        order.verify(plans).lockCurrentPlan(1L);
        order.verify(habits).findById(3L);
        verifyNoInteractions(logs);
    }
}
