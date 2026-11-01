package uy.miga.registro;

import org.springframework.stereotype.Service;
import uy.miga.plans.MealPortionSummary;
import uy.miga.plans.PlanFoodGroupDto;
import uy.miga.plans.PlanService;

import java.math.BigDecimal;
import java.util.*;

@Service
class ComparisonService {

    static final String ON_PLAN  = "EN_PLAN";
    static final String CLOSE    = "CASI";
    static final String OVER     = "DE_MAS";
    static final String MISSING  = "SIN_ANOTAR";
    static final String ASK      = "PREGUNTAR";

    private final PlanService planService;

    ComparisonService(PlanService planService) {
        this.planService = planService;
    }

    List<GroupStatus> compare(Long planId, Long mealId, Map<Long, BigDecimal> recordedPortions) {
        if ("LIBRE".equals(planService.getModoRegistro(planId))) return List.of();

        List<MealPortionSummary> planPortions = planService.getMealPortions(mealId);
        List<PlanFoodGroupDto> groups = planService.getPlanFoodGroups(planId);
        BigDecimal margin = planService.getMargenPorciones(planId);

        return compare(planPortions, groups, margin, recordedPortions);
    }

    List<GroupStatus> compare(uy.miga.plans.PlanReadData plan, Long mealId, Map<Long, BigDecimal> recordedPortions) {
        if ("LIBRE".equals(plan.mode())) return List.of();
        var portions = plan.meals().stream().filter(m -> m.id().equals(mealId)).findFirst()
            .map(uy.miga.plans.PlanReadData.MealData::portions).orElse(List.of());
        return compare(portions, plan.groups(), plan.margin(), recordedPortions);
    }

    private List<GroupStatus> compare(List<MealPortionSummary> planPortions, List<PlanFoodGroupDto> groups,
                                      BigDecimal margin, Map<Long, BigDecimal> recordedPortions) {
        Map<Long, String> groupNames = new HashMap<>();
        Map<Long, Boolean> askIfMissing = new HashMap<>();
        Map<Long, Boolean> optional = new HashMap<>();
        Map<Long, BigDecimal> dailyGoal = new HashMap<>();
        for (PlanFoodGroupDto g : groups) {
            groupNames.put(g.id(), g.name());
            askIfMissing.put(g.id(), Boolean.TRUE.equals(g.preguntarSiFalta()));
            optional.put(g.id(), Boolean.TRUE.equals(g.opcional()));
            dailyGoal.put(g.id(), g.metaDiaria());
        }

        List<GroupStatus> result = new ArrayList<>();
        for (MealPortionSummary plan : planPortions) {
            if (plan.portions().compareTo(BigDecimal.ZERO) == 0) continue;

            Long gid = plan.foodGroupId();
            BigDecimal recorded = recordedPortions.getOrDefault(gid, BigDecimal.ZERO);
            BigDecimal expected = plan.portions();
            BigDecimal diff     = recorded.subtract(expected).abs();

            // Grupos opcionales no penalizan cuando no están registrados
            if (Boolean.TRUE.equals(optional.get(gid)) && recorded.compareTo(BigDecimal.ZERO) == 0) continue;

            String status;
            if (recorded.compareTo(BigDecimal.ZERO) == 0) {
                status = Boolean.TRUE.equals(askIfMissing.get(gid)) ? ASK : MISSING;
            } else if (diff.compareTo(margin) <= 0) {
                status = ON_PLAN;
            } else if (recorded.compareTo(expected) < 0) {
                status = CLOSE;
            } else {
                status = OVER;
            }

            result.add(new GroupStatus(gid, groupNames.getOrDefault(gid, ""), expected, recorded, status,
                dailyGoal.get(gid)));
        }
        return result;
    }

    record GroupStatus(Long foodGroupId, String name, BigDecimal expected,
                       BigDecimal recorded, String status, BigDecimal dailyGoal) {}
}
