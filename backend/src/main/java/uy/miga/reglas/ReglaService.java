package uy.miga.reglas;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@Service
public class ReglaService {

    private final FoodRuleRepository repository;

    ReglaService(FoodRuleRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<FoodRule> findApplicable(Long planId, Long userId) {
        return repository.findApplicable(planId, userId);
    }

    @Transactional(readOnly = true)
    public List<FoodRuleDto> getUserRules(Long userId, Long planId) {
        return repository.findByUserIdAndPlanIdAndAlcance(userId, planId, "USUARIO")
            .stream().map(this::toDto).toList();
    }

    @Transactional
    public FoodRuleDto createUserRule(Long userId, Long planId, Long foodGroupId,
                                     String alimento, List<String> sinonimos,
                                     BigDecimal cantidadPorPorcion, String unidad,
                                     BigDecimal porcionPorDefecto) {
        FoodRule rule = new FoodRule();
        rule.setAlcance("USUARIO");
        rule.setUserId(userId);
        rule.setPlanId(planId);
        rule.setFoodGroupId(foodGroupId);
        rule.setAlimento(alimento.strip());
        rule.setSinonimos(sinonimos);
        rule.setTipo("NORMAL");
        rule.setCantidadPorPorcion(cantidadPorPorcion);
        rule.setUnidad(unidad);
        rule.setPorcionPorDefecto(porcionPorDefecto != null ? porcionPorDefecto : BigDecimal.ONE);
        return toDto(repository.save(rule));
    }

    @Transactional
    public void deleteUserRule(Long ruleId, Long userId) {
        FoodRule rule = repository.findById(ruleId)
            .filter(r -> userId.equals(r.getUserId()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        repository.delete(rule);
    }

    private FoodRuleDto toDto(FoodRule r) {
        return new FoodRuleDto(r.getId(), r.getAlcance(), r.getPlanId(), r.getUserId(),
            r.getAlimento(), r.getSinonimos(), r.getTipo(), r.getStandardGroupKey(),
            r.getFoodGroupId(), r.getComponentes(), r.getCantidadPorPorcion(),
            r.getUnidad(), r.getPorcionPorDefecto());
    }
}
