package uy.miga.plans;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uy.miga.users.UserService;

import java.math.BigDecimal;

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
        Plan plan = plansRepository.findByUserId(userId)
            .orElseThrow(() -> new PlanNotFoundException());
        return toDto(plan);
    }

    @Transactional
    PlanDto saveMyPlan(String email, PlanDto dto) {
        validatePortions(dto);
        Long userId = userService.findUserIdByEmail(email);

        Plan plan = plansRepository.findByUserId(userId).orElseGet(() -> {
            Plan p = new Plan();
            p.setUserId(userId);
            return p;
        });

        plan.getMeals().clear();

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

        return toDto(plansRepository.save(plan));
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
            return new MealDto(meal.getName(), meal.getSuggestedTime(), meal.getDisplayOrder(), portions);
        }).toList();
        return new PlanDto(meals);
    }
}
