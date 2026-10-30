package uy.miga.plans;

import java.util.Map;

public record PlanVersionCreated(Long userId, Long oldPlanId, Long newPlanId,
                                 Map<Long, Long> groupIdMap) {}
