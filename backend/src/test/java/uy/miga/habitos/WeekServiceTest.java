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
    void resolvesEachDayAndSkipsPortionGoalsForFreePlans() {
        var habits = mock(PlanHabitRepository.class);
        var logs = mock(HabitLogRepository.class);
        var entries = mock(FoodEntryFacade.class);
        var plans = mock(PlanService.class);
        var users = mock(UserService.class);
        var registro = mock(uy.miga.registro.RegistroService.class);
        var service = new WeekService(habits, logs, entries, plans, users, registro);
        LocalDate monday = LocalDate.of(2026, 1, 5);
        when(users.findUserIdByEmail("user")).thenReturn(1L);
        for (int i = 0; i < 7; i++) {
            when(plans.getPlanIdForDate(1L, monday.plusDays(i))).thenReturn(i < 3 ? 10L : 20L);
        }
        when(plans.getModoRegistro(10L)).thenReturn("PORCIONES");
        when(plans.getModoRegistro(20L)).thenReturn("LIBRE");
        when(plans.getMealIds(10L)).thenReturn(java.util.List.of(100L));
        when(plans.getMealPortions(100L)).thenReturn(java.util.List.of(new uy.miga.plans.MealPortionSummary(5L, new BigDecimal("2.5"))));
        var week = service.getWeek("user", monday);
        assertThat(week.days().get(0).totalGoal()).isEqualByComparingTo("2.5");
        assertThat(week.days().get(3).totalGoal()).isZero();
        for (int i = 0; i < 7; i++) verify(plans).getPlanIdForDate(1L, monday.plusDays(i));
        verify(plans, never()).getCurrentPlanId(any());
        verify(plans, never()).getMealIds(20L);
    }

    @Test
    void habitLogLocksBeforeReadingHabitAndRejectsOldPlan() {
        PlanHabitRepository habits = mock(PlanHabitRepository.class);
        HabitLogRepository logs = mock(HabitLogRepository.class);
        PlanService plans = mock(PlanService.class);
        UserService users = mock(UserService.class);
        WeekService service = new WeekService(habits, logs, mock(FoodEntryFacade.class), plans, users, mock(uy.miga.registro.RegistroService.class));
        when(users.findUserIdByEmail("user")).thenReturn(1L);
        when(plans.getPlanIdForDate(1L, LocalDate.now())).thenReturn(20L);
        PlanHabit habit = new PlanHabit();
        habit.setPlanId(19L);
        when(habits.findById(3L)).thenReturn(Optional.of(habit));

        assertThatThrownBy(() -> service.logHabit("user", 3L, LocalDate.now(), BigDecimal.ONE))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        var order = inOrder(plans, habits);
        order.verify(plans).lockCurrentPlan(1L);
        order.verify(habits).findById(3L);
        verifyNoInteractions(logs);
    }
}
