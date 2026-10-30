package uy.miga.intake;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import uy.miga.plans.PlanVersionCreated;

@Component("intakePlanVersionListener")
class PlanVersionListener {
    private final FoodEntryRepository repository;

    PlanVersionListener(FoodEntryRepository repository) {
        this.repository = repository;
    }

    @EventListener
    void moveTodayEntries(PlanVersionCreated event) {
        for (FoodEntry entry : repository.findByUserIdAndDateOrderByIdAsc(event.userId(), event.date())) {
            Long mealId = event.mealIdMap().get(entry.getMealId());
            if (mealId != null) {
                entry.setMealId(mealId);
                entry.setFoodGroupId(entry.getFoodGroupId() == null ? null : event.groupIdMap().get(entry.getFoodGroupId()));
            }
        }
    }
}
