package uy.miga.habitos;

import org.junit.jupiter.api.Test;
import java.time.OffsetDateTime;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class HabitConfigServiceTest {
    final PlanHabitRepository habits=mock(PlanHabitRepository.class);
    final HabitLogRepository logs=mock(HabitLogRepository.class);
    final HabitConfigService service=new HabitConfigService(habits,logs);
    PlanHabit habit() {
        PlanHabit habit=new PlanHabit(); habit.setName("Agua"); habit.setHabitType(HabitType.CANTIDAD);
        when(habits.findByPlanIdOrderByDisplayOrderAsc(1L)).thenReturn(List.of(habit)); return habit;
    }
    @Test void logsOnAnyVersionPreserveHabitAsArchived() {
        PlanHabit h=habit(); when(logs.existsByHabitUid(h.getUid())).thenReturn(true);
        service.removeHabit(1L,h.getUid());
        assertThat(h.getArchivedAt()).isNotNull(); assertThat(service.listHabits(1L)).isEmpty();
        verify(habits,never()).delete(any());
    }
    @Test void unusedHabitIsDeleted() {
        PlanHabit h=habit(); service.removeHabit(1L,h.getUid()); verify(habits).delete(h);
    }
    @Test void archivedHabitsCannotBeEdited() {
        PlanHabit h=habit(); h.setArchivedAt(OffsetDateTime.now());
        assertThatThrownBy(() -> service.updateHabit(1L,h.getUid(),new HabitInput("Agua","CANTIDAD","lt",null,"DIA",null)))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    }

    @Test void sharedValidationRejectsInvalidNumbersOnBothWriteRoutes() {
        var week = new WeekService(habits, logs, mock(uy.miga.intake.FoodEntryFacade.class),
            mock(uy.miga.plans.PlanService.class), mock(uy.miga.users.UserService.class), mock(uy.miga.registro.RegistroService.class));
        for (String step : List.of("0", "-1", "100001", "0.001")) {
            var value = new java.math.BigDecimal(step);
            assertThatThrownBy(() -> service.createHabit(1L, new HabitInput("Agua", "CANTIDAD", "lt", null, "DIA", value)))
                .isInstanceOfSatisfying(org.springframework.web.server.ResponseStatusException.class,
                    e -> assertThat(e.getStatusCode().value()).isEqualTo(400));
            assertThatThrownBy(() -> week.createHabit("user", new HabitSaveDto("Agua", "CANTIDAD", "lt", null, value, "DIA", false, (short) 1)))
                .isInstanceOfSatisfying(org.springframework.web.server.ResponseStatusException.class,
                    e -> assertThat(e.getStatusCode().value()).isEqualTo(400));
        }
        for (String goal : List.of("-1", "100001")) {
            assertThatThrownBy(() -> HabitValidation.configuration(new HabitInput("Agua", "CANTIDAD", "lt",
                new java.math.BigDecimal(goal), "DIA", null))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        }
        HabitValidation.configuration(new HabitInput("Agua", "CANTIDAD", "lt", java.math.BigDecimal.ZERO, "DIA", null));
        HabitValidation.log(HabitType.SI_NO, java.math.BigDecimal.ZERO);
        HabitValidation.log(HabitType.SI_NO, java.math.BigDecimal.ONE);
        verify(habits, never()).save(any());
    }
}
