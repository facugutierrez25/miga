package uy.miga.registro;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import uy.miga.plans.PlanVersionCreated;

@Component("registroPlanVersionListener")
class PlanVersionListener {
    private final MealNoteRepository repository;

    PlanVersionListener(MealNoteRepository repository) {
        this.repository = repository;
    }

    @EventListener
    void moveTodayNotes(PlanVersionCreated event) {
        for (MealNote note : repository.findByUserIdAndDate(event.userId(), event.date())) {
            Long mealId = event.mealIdMap().get(note.getMealId());
            if (event.oldPlanId().equals(note.getPlanId()) && mealId != null) {
                note.setPlanId(event.newPlanId());
                note.setMealId(mealId);
            }
        }
    }
}
