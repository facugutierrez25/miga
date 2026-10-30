package uy.miga.habitos;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import uy.miga.plans.PlanVersionCreated;

@Component("habitPlanVersionListener")
class PlanVersionListener {
    private final PlanHabitRepository repository;
    private final HabitLogRepository logs;

    PlanVersionListener(PlanHabitRepository repository, HabitLogRepository logs) {
        this.repository = repository;
        this.logs = logs;
    }

    @EventListener
    void copyHabits(PlanVersionCreated event) {
        for (PlanHabit source : repository.findByPlanIdOrderByDisplayOrderAsc(event.oldPlanId())) {
            if (source.getArchivedAt() != null) continue;
            PlanHabit copy = new PlanHabit();
            copy.setPlanId(event.newPlanId());
            copy.setUid(source.getUid());
            copy.setCreatedAt(source.getCreatedAt());
            copy.setName(source.getName());
            copy.setHabitType(source.getHabitType());
            copy.setUnit(source.getUnit());
            copy.setDailyGoal(source.getDailyGoal());
            copy.setStep(source.getStep());
            copy.setPeriod(source.getPeriod());
            copy.setDisplayOrder(source.getDisplayOrder());
            repository.save(copy);
            logs.findByUserIdAndPlanHabitIdAndLogDate(event.userId(), source.getId(), event.date())
                .filter(log -> log.getHabitUid().equals(copy.getUid()))
                .ifPresent(log -> log.setPlanHabitId(copy.getId()));
        }
    }
}
