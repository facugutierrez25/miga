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

        Map<Long, String> groupNames = new HashMap<>();
        Map<Long, Boolean> askIfMissing = new HashMap<>();
        for (PlanFoodGroupDto g : groups) {
            groupNames.put(g.id(), g.name());
            askIfMissing.put(g.id(), Boolean.TRUE.equals(g.preguntarSiFalta()));
        }

        List<GroupStatus> result = new ArrayList<>();
        for (MealPortionSummary plan : planPortions) {
            if (plan.portions().compareTo(BigDecimal.ZERO) == 0) continue;

            Long gid = plan.foodGroupId();
            BigDecimal recorded = recordedPortions.getOrDefault(gid, BigDecimal.ZERO);
            BigDecimal expected = plan.portions();
            BigDecimal diff     = recorded.subtract(expected).abs();

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

            result.add(new GroupStatus(gid, groupNames.getOrDefault(gid, ""), expected, recorded, status));
        }
        return result;
    }

    record GroupStatus(Long foodGroupId, String name, BigDecimal expected,
                       BigDecimal recorded, String status) {}
}
