package uy.miga.planrules;

import org.junit.jupiter.api.Test;
import uy.miga.plans.*;
import uy.miga.reglas.ReglaService;
import uy.miga.habitos.HabitConfigService;
import uy.miga.registro.RegistroService;
import uy.miga.intake.FoodEntryFacade;
import uy.miga.users.UserService;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PlanRulesServiceTest {
    @Test void unchangedOrderDoesNotForkOrBumpEvenWhenPlanHasNotes() {
        var plans = mock(PlanService.class);
        var rules = mock(ReglaService.class);
        var habits = mock(HabitConfigService.class);
        var notes = mock(RegistroService.class);
        var entries = mock(FoodEntryFacade.class);
        var users = mock(UserService.class);
        when(users.findUserIdByEmail("user")).thenReturn(7L);
        when(plans.currentPlanRef(7L)).thenReturn(new PlanRef(31L, 4L));
        when(plans.getPlanFoodGroups(31L)).thenReturn(List.of());
        var service = new PlanRulesService(plans, rules, habits, notes, entries, users);
        var result = service.order("user", new Requests.Order(4L, List.of()));
        assertThat(result.planId()).isEqualTo(31L);
        assertThat(result.planVersion()).isEqualTo(4L);
        verify(plans, never()).forkCurrentPlan(any());
        verify(plans, never()).checkAndBumpVersion(any(), any());
        verifyNoInteractions(notes, entries);
        assertThatThrownBy(() -> service.order("user", new Requests.Order(3L, List.of())))
            .isInstanceOf(PlanVersionConflictException.class);
    }

    @Test void unchangedGroupDoesNotForkWhenColorIsOmitted() {
        var plans = mock(PlanService.class);
        var rules = mock(ReglaService.class);
        var habits = mock(HabitConfigService.class);
        var notes = mock(RegistroService.class);
        var entries = mock(FoodEntryFacade.class);
        var users = mock(UserService.class);
        var uid = java.util.UUID.randomUUID();
        when(users.findUserIdByEmail("user")).thenReturn(7L);
        when(plans.currentPlanRef(7L)).thenReturn(new PlanRef(31L, 4L));
        when(plans.getPlanFoodGroups(31L)).thenReturn(List.of(new PlanFoodGroupDto(
            1L, "Frutas", "FRU", 1, "#123456", "frutas", true, false, uid)));
        var service = new PlanRulesService(plans, rules, habits, notes, entries, users);
        assertThat(service.group("user", uid, new Requests.Group(4L, " Frutas ", "FRU", "frutas", null, true, false))
            .planId()).isEqualTo(31L);
        verify(plans, never()).forkCurrentPlan(any());
        verify(plans, never()).updateGroup(any(), any(), any());
        verify(plans, never()).checkAndBumpVersion(any(), any());
        verifyNoInteractions(notes, entries);
    }
    @Test void unchangedHabitIgnoresDecimalScaleAndDefaultStep() {
        var plans = mock(PlanService.class);
        var rules = mock(ReglaService.class);
        var habits = mock(HabitConfigService.class);
        var notes = mock(RegistroService.class);
        var entries = mock(FoodEntryFacade.class);
        var users = mock(UserService.class);
        var uid = java.util.UUID.randomUUID();
        when(users.findUserIdByEmail("user")).thenReturn(7L);
        when(plans.currentPlanRef(7L)).thenReturn(new PlanRef(31L, 4L));
        when(habits.listHabits(31L)).thenReturn(List.of(new uy.miga.habitos.HabitConfigDto(
            uid, 1L, "Agua", "NUMERIC", "vasos", new java.math.BigDecimal("8.000"), "DAILY",
            java.math.BigDecimal.ONE, (short) 1, false)));
        var service = new PlanRulesService(plans, rules, habits, notes, entries, users);
        assertThat(service.habit("user", uid, new Requests.Habit(4L, "Agua", "NUMERIC", "vasos",
            new java.math.BigDecimal("8"), "DAILY", null, false)).planId()).isEqualTo(31L);
        verify(plans, never()).forkCurrentPlan(any());
        verify(habits, never()).updateHabit(any(), any(), any());
        verify(plans, never()).checkAndBumpVersion(any(), any());
        verifyNoInteractions(notes, entries);
    }
}
