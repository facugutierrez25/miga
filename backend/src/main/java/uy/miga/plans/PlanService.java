package uy.miga.plans;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uy.miga.users.UserService;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

@Service
class PlanService {

    private final PlansRepository plansRepository;
    private final UserService userService;

    PlanService(PlansRepository plansRepository, UserService userService) {
        this.plansRepository = plansRepository;
        this.userService = userService;
    }

    @Transactional(readOnly = true)
    PlanDto getMyPlan(String email) {
        Long userId = userService.findUserIdByEmail(email);
        Plan plan = plansRepository.findByUserIdAndCurrentTrue(userId)
            .orElseThrow(PlanNotFoundException::new);
        return toDto(plan);
    }

    @Transactional
    PlanDto saveMyPlan(String email, PlanDto dto) {
        validatePortions(dto);
        Long userId = userService.findUserIdByEmail(email);

        // Si el plan vigente no cambió, devolver sin tocar la base
        var existing = plansRepository.findByUserIdAndCurrentTrue(userId);
        if (existing.isPresent() && !planChanged(existing.get(), dto)) {
            return toDto(existing.get());
        }

        // Archivar plan vigente si existe
        existing.ifPresent(old -> {
            old.setCurrent(false);
            old.setSupersededAt(OffsetDateTime.now());
            plansRepository.save(old);
        });

        // Crear nuevo plan vigente
        Plan plan = new Plan();
        plan.setUserId(userId);

        buildMeals(plan, dto);
        return toDto(plansRepository.save(plan));
    }

    @Transactional(readOnly = true)
    List<PlanSummaryDto> getPlanHistory(String email) {
        Long userId = userService.findUserIdByEmail(email);
        return plansRepository.findAllByUserIdAndCurrentFalseOrderBySupersededAtDesc(userId)
            .stream()
            .map(p -> new PlanSummaryDto(
                p.getCreatedAt().toLocalDate(),
                p.getSupersededAt().toLocalDate(),
                p.getMeals().size(),
                p.getMeals().stream().map(meal -> new MealSummaryDto(
                    meal.getName(),
                    meal.getPortions().stream()
                        .filter(por -> por.getPortions().compareTo(java.math.BigDecimal.ZERO) > 0)
                        .map(por -> new MealPortionDto(por.getFoodGroup(), por.getPortions()))
                        .toList()
                )).toList()
            ))
            .toList();
    }

    private void buildMeals(Plan plan, PlanDto dto) {
        for (MealDto mealDto : dto.meals()) {
            Meal meal = new Meal();
            meal.setPlan(plan);
            meal.setName(mealDto.name());
            meal.setSuggestedTime(mealDto.suggestedTime());
            meal.setDisplayOrder(mealDto.displayOrder());
            for (MealPortionDto portionDto : mealDto.portions()) {
                MealPortion portion = new MealPortion();
                portion.setMeal(meal);
                portion.setFoodGroup(portionDto.foodGroup());
                portion.setPortions(portionDto.portions());
                meal.getPortions().add(portion);
            }
            plan.getMeals().add(meal);
        }
    }

    private boolean planChanged(Plan current, PlanDto dto) {
        List<Meal> currentMeals = current.getMeals().stream()
                .sorted(java.util.Comparator.comparingInt(Meal::getDisplayOrder))
                .toList();
        List<MealDto> newMeals = dto.meals().stream()
                .sorted(java.util.Comparator.comparingInt(MealDto::displayOrder))
                .toList();

        if (currentMeals.size() != newMeals.size()) return true;

        for (int i = 0; i < currentMeals.size(); i++) {
            Meal cm = currentMeals.get(i);
            MealDto nm = newMeals.get(i);
            if (!cm.getName().equals(nm.name())) return true;
            if (!java.util.Objects.equals(cm.getSuggestedTime(), nm.suggestedTime())) return true;

            var currentPortions = cm.getPortions().stream()
                    .sorted(java.util.Comparator.comparing(p -> p.getFoodGroup().name()))
                    .toList();
            var newPortions = nm.portions().stream()
                    .sorted(java.util.Comparator.comparing(p -> p.foodGroup().name()))
                    .toList();

            if (currentPortions.size() != newPortions.size()) return true;
            for (int j = 0; j < currentPortions.size(); j++) {
                if (currentPortions.get(j).getFoodGroup() != newPortions.get(j).foodGroup()) return true;
                if (currentPortions.get(j).getPortions().compareTo(newPortions.get(j).portions()) != 0) return true;
            }
        }
        return false;
    }

    private void validatePortions(PlanDto dto) {
        for (MealDto meal : dto.meals()) {
            for (MealPortionDto portion : meal.portions()) {
                BigDecimal remainder = portion.portions().remainder(new BigDecimal("0.5"));
                if (remainder.compareTo(BigDecimal.ZERO) != 0) {
                    throw new InvalidPortionsException();
                }
            }
        }
    }

    private PlanDto toDto(Plan plan) {
        var meals = plan.getMeals().stream().map(meal -> {
            var portions = meal.getPortions().stream()
                .map(p -> new MealPortionDto(p.getFoodGroup(), p.getPortions()))
                .toList();
            return new MealDto(meal.getId(), meal.getName(), meal.getSuggestedTime(), meal.getDisplayOrder(), portions);
        }).toList();
        return new PlanDto(meals);
    }
}
