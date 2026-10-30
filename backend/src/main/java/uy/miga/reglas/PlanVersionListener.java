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
        for (FoodRule source : repository.findByPlanIdAndAlcanceIn(event.oldPlanId(), List.of("PLAN", "USUARIO"))) {
            FoodRule copy = new FoodRule();
            copy.setUid(source.getUid());
            copy.setOverridesRuleUid(source.getOverridesRuleUid());
            copy.setPlanId(event.newPlanId());
            copy.setUserId(source.getUserId());
            copy.setAlcance(source.getAlcance());
            copy.setAlimento(source.getAlimento());
            copy.setSinonimos(source.getSinonimos() == null ? null : List.copyOf(source.getSinonimos()));
            copy.setTipo(source.getTipo());
            copy.setStandardGroupKey(source.getStandardGroupKey());
            copy.setFoodGroupId(remap(source.getFoodGroupId(), event.groupIdMap()));
            copy.setComponentes(source.getComponentes() == null ? null : source.getComponentes().stream()
                .map(c -> new Componente(remap(c.foodGroupId(), event.groupIdMap()), c.standardGroupKey(), c.porciones()))
                .toList());
            copy.setCantidadPorPorcion(source.getCantidadPorPorcion());
            copy.setUnidad(source.getUnidad());
            copy.setPorcionPorDefecto(source.getPorcionPorDefecto());
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
