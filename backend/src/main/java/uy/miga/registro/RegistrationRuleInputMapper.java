package uy.miga.registro;

import org.springframework.stereotype.Component;
import uy.miga.intake.FoodEntryFacade;
import uy.miga.plans.PlanService;
import uy.miga.reglas.FoodRuleDto;
import uy.miga.reglas.RuleComponent;
import uy.miga.reglas.RuleInput;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Component
class RegistrationRuleInputMapper {
    private final PlanService planService;
    private final DailyLogSupport support;

    RegistrationRuleInputMapper(PlanService planService, DailyLogSupport support) {
        this.planService = planService;
        this.support = support;
    }

    Long mapRuleGroup(Long id, String key, Long sourcePlan, Long targetPlan) {
        var target = planService.getPlanFoodGroups(targetPlan);
        if (id == null) return key == null ? null : support.resolveGroupId(key, targetPlan);
        if (target.stream().anyMatch(g -> id.equals(g.id()))) return id;
        if (sourcePlan == null) return null;
        return planService.findEquivalentGroupId(id, sourcePlan, targetPlan).orElse(null);
    }

    RuleInput resolveRuleInput(FoodEntryFacade.EntryData entry, FoodRuleDto selected, String type,
            Map<Long, BigDecimal> groups, Long planId, Long currentPlan) {
        Long groupId = null;
        List<RuleComponent> components = new ArrayList<>();
        BigDecimal amount = null;
        String unit = null;
        BigDecimal defaultPortion = BigDecimal.ONE;
        if (selected != null) {
            amount = selected.amountPerPortion();
            unit = selected.unit();
            defaultPortion = selected.defaultPortions();
            if ("NORMAL".equals(type)) {
                groupId = mapRuleGroup(selected.foodGroupId(), selected.standardGroupKey(), selected.planId(), currentPlan);
                if (groupId == null) return null;
            } else if ("COMPUESTO".equals(type)) {
                for (var c : selected.components()) {
                    Long mapped = mapRuleGroup(c.foodGroupId(), c.standardGroupKey(), selected.planId(), currentPlan);
                    if (mapped == null) return null;
                    components.add(new RuleComponent(mapped, null, c.portions()));
                }
            }
        } else if (!groups.isEmpty()) {
            BigDecimal quantity = BigDecimal.valueOf(entry.quantity());
            unit = entry.unit();
            amount = unit != null ? BigDecimal.ONE : null;
            for (var g : groups.entrySet()) {
                Long mapped = mapRuleGroup(g.getKey(), null, planId, currentPlan);
                if (mapped == null) return null;
                if (groups.size() == 1) {
                    groupId = mapped;
                    if (unit == null) defaultPortion = g.getValue();
                    else amount = quantity.divide(g.getValue(), 6, RoundingMode.HALF_UP);
                } else components.add(new RuleComponent(mapped, null, g.getValue().divide(quantity, 6, RoundingMode.HALF_UP).doubleValue()));
            }
        }
        return new RuleInput(entry.food(), List.of(), type, groupId, amount, unit, defaultPortion, components, null, selected != null && selected.countsFlexible());
    }

}
