package uy.miga.reglas;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import uy.miga.plans.PlanVersionCreated;

import java.util.List;
import java.util.Map;

@Component
class PlanVersionListener {
    private final FoodRuleRepository repository;

    PlanVersionListener(FoodRuleRepository repository) {
        this.repository = repository;
    }

    @EventListener
    void copyRules(PlanVersionCreated event) {
        for (FoodRule source : repository.findByPlanIdAndScopeIn(event.oldPlanId(), List.of("PLAN", "USUARIO"))) {
            FoodRule copy = new FoodRule();
            copy.setUid(source.getUid());
            copy.setOverridesRuleUid(source.getOverridesRuleUid());
            copy.setPlanId(event.newPlanId());
            copy.setUserId(source.getUserId());
            copy.setScope(source.getScope());
            copy.setFood(source.getFood());
            copy.setSynonyms(source.getSynonyms() == null ? null : List.copyOf(source.getSynonyms()));
            copy.setType(source.getType());
            copy.setStandardGroupKey(source.getStandardGroupKey());
            copy.setFoodGroupId(remap(source.getFoodGroupId(), event.groupIdMap()));
            copy.setComponents(source.getComponents() == null ? null : source.getComponents().stream()
                .map(c -> new RuleComponent(remap(c.foodGroupId(), event.groupIdMap()), c.standardGroupKey(), c.portions()))
                .toList());
            copy.setAmountPerPortion(source.getAmountPerPortion());
            copy.setUnit(source.getUnit());
            copy.setDefaultPortions(source.getDefaultPortions());
            repository.save(copy);
        }
    }

    private Long remap(Long id, Map<Long, Long> groupIdMap) {
        if (id == null) return null;
        Long mapped = groupIdMap.get(id);
        if (mapped == null) throw new IllegalStateException("Missing group mapping: " + id);
        return mapped;
    }
}
