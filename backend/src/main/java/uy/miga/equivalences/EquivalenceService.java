package uy.miga.equivalences;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uy.miga.plans.PlanService;
import uy.miga.reglas.FoodRuleDto;
import uy.miga.reglas.ReglaService;
import uy.miga.users.UserService;

import java.math.BigDecimal;
import java.util.List;

@Service
class EquivalenceService {

    private final ReglaService reglaService;
    private final PlanService planService;
    private final UserService userService;

    EquivalenceService(ReglaService reglaService, PlanService planService, UserService userService) {
        this.reglaService = reglaService;
        this.planService = planService;
        this.userService = userService;
    }

    @Transactional(readOnly = true)
    List<EquivalenceDto> getEquivalences(String userEmail) {
        Long userId = userService.findUserIdByEmail(userEmail);
        Long planId = planService.getCurrentPlanId(userEmail);
        return reglaService.getUserRules(userId, planId)
            .stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    EquivalenceDto addEquivalence(String userEmail, Long foodGroupId,
                                  String food, Double quantity, Unit unit) {
        Long userId = userService.findUserIdByEmail(userEmail);
        Long planId = planService.getCurrentPlanId(userEmail);
        FoodRuleDto created = reglaService.createUserRule(
            userId, planId, foodGroupId, food,
            List.of(),
            BigDecimal.valueOf(quantity), unit.name(),
            BigDecimal.ONE
        );
        return toDto(created);
    }

    @Transactional
    void deleteEquivalence(String userEmail, Long id) {
        Long userId = userService.findUserIdByEmail(userEmail);
        reglaService.deleteUserRule(id, userId);
    }

    private EquivalenceDto toDto(FoodRuleDto r) {
        Double qty = r.cantidadPorPorcion() != null ? r.cantidadPorPorcion().doubleValue() : null;
        Unit unit = r.unidad() != null ? Unit.valueOf(r.unidad()) : null;
        return new EquivalenceDto(r.id(), r.foodGroupId(), r.alimento(), qty, unit);
    }
}
