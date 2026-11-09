package uy.miga.plans;

import java.util.Map;
import java.time.LocalDate;

public record PlanVersionCreated(Long userId, Long oldPlanId, Long newPlanId,
                                 Map<Long, Long> groupIdMap, Map<Long, Long> mealIdMap,
                                 LocalDate date) {}
