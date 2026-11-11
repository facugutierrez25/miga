package uy.miga.intake;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uy.miga.plans.PlanService;
import uy.miga.reglas.FoodRuleDto;
import uy.miga.reglas.FoodRuleService;
import uy.miga.users.UserService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import uy.miga.plans.PlanNotFoundException;
import uy.miga.plans.PlanVersionConflictException;

@Service
class FoodEntryService {

    private final FoodEntryRepository repository;
    private final UserService userService;
    private final PlanService planService;
    private final FoodRuleService ruleService;

    FoodEntryService(FoodEntryRepository repository, UserService userService,
                     PlanService planService, FoodRuleService ruleService) {
        this.repository = repository;
        this.userService = userService;
        this.planService = planService;
        this.ruleService = ruleService;
    }

    @Transactional(readOnly = true)
    List<FoodEntryDto> getEntriesForDay(String userEmail, LocalDate date) {
        Long userId = userService.findUserIdByEmail(userEmail);
        return repository.findByUserIdAndDateOrderByIdAsc(userId, date)
            .stream().map(this::toDto).toList();
    }

    @Transactional
    FoodEntryDto addEntry(String userEmail, Long mealId, LocalDate date,
                          String food, Double quantity, String unit, Long foodGroupId) {
        if (food == null || food.isBlank() || food.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá un nombre de alimento de hasta 100 caracteres.");
        }
        Long userId = userService.findUserIdByEmail(userEmail);
        lockCurrentPlanIfPresent(userId);
        if (!planService.mealBelongsToUser(mealId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        Long planId = planService.getPlanIdForDate(userId, date);
        if (!planService.getMealIds(planId).contains(mealId)) {
            throw new PlanVersionConflictException();
        }
        if (foodGroupId != null && planService.getPlanFoodGroups(planId).stream()
            .noneMatch(g -> g.id().equals(foodGroupId))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Los grupos no pertenecen a tu plan.");
        }
        BigDecimal portions = calculatePortions(food, foodGroupId, quantity, planId, userId);

        FoodEntry entry = new FoodEntry(userId, userEmail, mealId, date, food.strip(), quantity, unit.strip(), foodGroupId);
        entry.setOrigin(EntryOrigin.USER);
        entry.setRuleSource(EntryOrigin.USER);
        entry.setPortions(portions);
        return toDto(repository.save(entry));
    }

    private BigDecimal calculatePortions(String food, Long foodGroupId, Double quantity,
                                         Long planId, Long userId) {
        List<FoodRuleDto> rules = ruleService.findApplicable(planId, userId);
        Optional<FoodRuleDto> match = rules.stream()
            .filter(r -> r.food() != null && r.food().equalsIgnoreCase(food.strip()))
            .filter(r -> foodGroupId.equals(r.foodGroupId()))
            .findFirst();
        if (match.isEmpty()) return null;
        FoodRuleDto rule = match.get();
        if (rule.amountPerPortion() != null && rule.amountPerPortion().compareTo(BigDecimal.ZERO) != 0) {
            return BigDecimal.valueOf(quantity)
                .divide(rule.amountPerPortion(), 3, RoundingMode.HALF_UP);
        }
        if (rule.defaultPortions() != null) {
            return rule.defaultPortions().multiply(BigDecimal.valueOf(quantity))
                .setScale(3, RoundingMode.HALF_UP);
        }
        return null;
    }

    @Transactional
    void deleteEntry(String userEmail, Long id) {
        Long userId = userService.findUserIdByEmail(userEmail);
        lockCurrentPlanIfPresent(userId);
        FoodEntry entry = repository.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        repository.delete(entry);
    }

    @Transactional
    void markConsumed(String userEmail, Long mealId, LocalDate date, boolean consumed) {
        Long userId = userService.findUserIdByEmail(userEmail);
        lockCurrentPlanIfPresent(userId);
        if (!planService.mealBelongsToUser(mealId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        Long planId = planService.getPlanIdForDate(userId, date);
        if (!planService.getMealIds(planId).contains(mealId)) {
            throw new PlanVersionConflictException();
        }
        repository.setConsumedByMeal(userId, mealId, date, consumed);
    }

    private void lockCurrentPlanIfPresent(Long userId) {
        try {
            planService.lockCurrentPlan(userId);
        } catch (PlanNotFoundException ignored) {
            // Un registro histórico puede existir sin plan vigente.
        }
    }

    private FoodEntryDto toDto(FoodEntry e) {
        return new FoodEntryDto(e.getId(), e.getMealId(), e.getFood(), e.getQuantity(), e.getUnit(),
            e.getFoodGroupId(), e.isConsumed(), e.getPortions(), e.isCountsFlexible() || "FLEXIBLE".equals(e.getRuleType()));
    }
}
