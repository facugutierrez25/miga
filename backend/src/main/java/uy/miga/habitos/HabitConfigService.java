package uy.miga.habitos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.List;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Service
@Transactional
public class HabitConfigService {
    private final PlanHabitRepository habits;
    private final HabitLogRepository logs;
    HabitConfigService(PlanHabitRepository habits, HabitLogRepository logs) { this.habits = habits; this.logs = logs; }
    @Transactional(readOnly = true)
    public List<HabitConfigDto> listHabits(Long planId) {
        return habits.findByPlanIdOrderByDisplayOrderAsc(planId).stream().filter(h -> h.getArchivedAt() == null).map(this::dto).toList();
    }
    public HabitConfigDto createHabit(Long planId, HabitInput input) {
        PlanHabit habit = new PlanHabit(); habit.setPlanId(planId);
        habit.setDisplayOrder((short)(listHabits(planId).stream().mapToInt(HabitConfigDto::displayOrder).max().orElse(0) + 1));
        apply(habit, input); return dto(habits.save(habit));
    }
    public HabitConfigDto updateHabit(Long planId, UUID uid, HabitInput input) {
        PlanHabit habit = find(planId, uid); apply(habit, input); return dto(habit);
    }
    public void removeHabit(Long planId, UUID uid) {
        PlanHabit habit = find(planId, uid);
        if (logs.existsByHabitUid(uid)) habit.setArchivedAt(OffsetDateTime.now()); else habits.delete(habit);
    }
    @Transactional(readOnly = true)
    public boolean planHasLogs(Long planId) {
        var ids = habits.findByPlanIdOrderByDisplayOrderAsc(planId).stream().map(PlanHabit::getId).toList();
        return !ids.isEmpty() && logs.existsByPlanHabitIdIn(ids);
    }
    private PlanHabit find(Long planId, UUID uid) {
        return habits.findByPlanIdOrderByDisplayOrderAsc(planId).stream()
            .filter(h -> h.getUid().equals(uid) && h.getArchivedAt() == null).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Hábito no encontrado."));
    }
    private void apply(PlanHabit h, HabitInput in) {
        if (in.name() == null || in.name().isBlank() || in.name().length() > 100 ||
            in.habitType() == null || !List.of("CONTADOR", "SI_NO", "CANTIDAD").contains(in.habitType()) ||
            in.period() == null || !List.of("DIA", "SEMANA").contains(in.period()) ||
            (in.goal() != null && in.goal().signum() <= 0) || (in.step() != null && in.step().signum() <= 0) ||
            (in.unit() != null && in.unit().length() > 40)) throw new IllegalArgumentException("Configuración de hábito inválida.");
        h.setCountsFlexibleMeals(in.countsFlexibleMeals());
        h.setName(in.name().strip()); h.setHabitType(HabitType.valueOf(in.habitType())); h.setUnit(in.unit());
        h.setDailyGoal(in.goal()); h.setPeriod(in.period()); h.setStep(in.step() == null ? BigDecimal.ONE : in.step());
    }
    private HabitConfigDto dto(PlanHabit h) {
        return new HabitConfigDto(h.getUid(), h.getId(), h.getName(), h.getHabitType().name(), h.getUnit(), h.getDailyGoal(), h.getPeriod(), h.getStep(), h.getDisplayOrder(), h.isCountsFlexibleMeals());
    }
}
