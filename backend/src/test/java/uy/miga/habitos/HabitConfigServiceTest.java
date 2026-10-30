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
}
