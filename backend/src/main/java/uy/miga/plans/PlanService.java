package uy.miga.plans;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uy.miga.users.UserService;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PlanService {

    private static final List<Object[]> DEFAULT_GROUPS = List.of(
        new Object[]{"Proteínas", "PRO", 1},
        new Object[]{"Cereales",  "CER", 2},
        new Object[]{"Frutas",    "FRU", 3},
        new Object[]{"Lácteos",   "LAC", 4},
        new Object[]{"Grasas",    "GRA", 5},
        new Object[]{"Verduras",  "VER", 6}
    );

    private final PlansRepository plansRepository;
    private final PlanFoodGroupRepository groupRepository;
    private final MealRepository mealRepository;
    private final UserService userService;

    PlanService(PlansRepository plansRepository,
                PlanFoodGroupRepository groupRepository,
                MealRepository mealRepository,
                UserService userService) {
        this.plansRepository = plansRepository;
        this.groupRepository = groupRepository;
        this.mealRepository = mealRepository;
        this.userService = userService;
    }

    @Transactional(readOnly = true)
    public Long getCurrentPlanId(String email) {
        Long userId = userService.findUserIdByEmail(email);
        return plansRepository.findByUserIdAndCurrentTrue(userId)
            .map(Plan::getId)
            .orElseThrow(PlanNotFoundException::new);
    }

    @Transactional(readOnly = true)
    PlanDto getMyPlan(String email) {
        Long userId = userService.findUserIdByEmail(email);
        Plan plan = plansRepository.findByUserIdAndCurrentTrue(userId)
            .orElseThrow(PlanNotFoundException::new);
        return toDto(plan);
    }

    @Transactional
    PlanDto saveMyPlan(String email, PlanSaveDto dto) {
        validatePortions(dto);
        Long userId = userService.findUserIdByEmail(email);

        var existing = plansRepository.findByUserIdAndCurrentTrue(userId);
        if (existing.isPresent() && !planChanged(existing.get(), dto)) {
            return toDto(existing.get());
        }

        existing.ifPresent(old -> {
            old.setCurrent(false);
            old.setSupersededAt(OffsetDateTime.now());
            plansRepository.save(old);
        });

        Plan plan = new Plan();
        plan.setUserId(userId);
        createDefaultFoodGroups(plan);
        Plan savedPlan = plansRepository.save(plan);

        Map<String, Long> abbrToId = savedPlan.getFoodGroups().stream()
            .collect(Collectors.toMap(PlanFoodGroup::getAbbreviation, PlanFoodGroup::getId));

        buildMeals(savedPlan, dto, abbrToId);
        return toDto(plansRepository.save(savedPlan));
    }

    @Transactional(readOnly = true)
    List<PlanSummaryDto> getPlanHistory(String email) {
        Long userId = userService.findUserIdByEmail(email);
        return plansRepository.findAllByUserIdAndCurrentFalseOrderBySupersededAtDesc(userId)
            .stream()
            .map(p -> {
                List<PlanFoodGroupDto> groups = toGroupDtos(p.getFoodGroups());
                List<MealSummaryDto> meals = p.getMeals().stream().map(meal -> new MealSummaryDto(
                    meal.getName(),
                    meal.getPortions().stream()
                        .filter(por -> por.getPortions().compareTo(BigDecimal.ZERO) > 0)
                        .map(por -> new MealPortionDto(por.getFoodGroupId(), por.getPortions()))
                        .toList()
                )).toList();
                return new PlanSummaryDto(
                    p.getCreatedAt().toLocalDate(),
                    p.getSupersededAt().toLocalDate(),
                    p.getMeals().size(),
                    groups,
                    meals
                );
            })
            .toList();
    }

    private void createDefaultFoodGroups(Plan plan) {
        for (Object[] g : DEFAULT_GROUPS) {
            plan.getFoodGroups().add(new PlanFoodGroup(plan, (String) g[0], (String) g[1], (short)(int) g[2]));
        }
    }

    private void buildMeals(Plan plan, PlanSaveDto dto, Map<String, Long> abbrToId) {
        for (MealSaveDto mealDto : dto.meals()) {
            Meal meal = new Meal();
            meal.setPlan(plan);
            meal.setName(mealDto.name());
            meal.setSuggestedTime(mealDto.suggestedTime());
            meal.setDisplayOrder(mealDto.displayOrder());
            for (MealPortionInput input : mealDto.portions()) {
                Long groupId = abbrToId.get(input.foodGroupAbbr());
                if (groupId == null) throw new InvalidPortionsException();
                MealPortion portion = new MealPortion();
                portion.setMeal(meal);
                portion.setFoodGroupId(groupId);
                portion.setPortions(input.portions());
                meal.getPortions().add(portion);
            }
            plan.getMeals().add(meal);
        }
    }

    private boolean planChanged(Plan current, PlanSaveDto dto) {
        Map<Long, String> idToAbbr = current.getFoodGroups().stream()
            .collect(Collectors.toMap(PlanFoodGroup::getId, PlanFoodGroup::getAbbreviation));

        List<Meal> currentMeals = current.getMeals().stream()
            .sorted(java.util.Comparator.comparingInt(Meal::getDisplayOrder))
            .toList();
        List<MealSaveDto> newMeals = dto.meals().stream()
            .sorted(java.util.Comparator.comparingInt(MealSaveDto::displayOrder))
            .toList();

        if (currentMeals.size() != newMeals.size()) return true;

        for (int i = 0; i < currentMeals.size(); i++) {
            Meal cm = currentMeals.get(i);
            MealSaveDto nm = newMeals.get(i);
            if (!cm.getName().equals(nm.name())) return true;
            if (!java.util.Objects.equals(cm.getSuggestedTime(), nm.suggestedTime())) return true;

            var currentPortions = cm.getPortions().stream()
                .sorted(java.util.Comparator.comparing(p -> idToAbbr.getOrDefault(p.getFoodGroupId(), "")))
                .toList();
            var newPortions = nm.portions().stream()
                .sorted(java.util.Comparator.comparing(MealPortionInput::foodGroupAbbr))
                .toList();

            if (currentPortions.size() != newPortions.size()) return true;
            for (int j = 0; j < currentPortions.size(); j++) {
                String currAbbr = idToAbbr.getOrDefault(currentPortions.get(j).getFoodGroupId(), "");
                if (!currAbbr.equals(newPortions.get(j).foodGroupAbbr())) return true;
                if (currentPortions.get(j).getPortions().compareTo(newPortions.get(j).portions()) != 0) return true;
            }
        }
        return false;
    }

    private void validatePortions(PlanSaveDto dto) {
        for (MealSaveDto meal : dto.meals()) {
            for (MealPortionInput portion : meal.portions()) {
                BigDecimal remainder = portion.portions().remainder(new BigDecimal("0.5"));
                if (remainder.compareTo(BigDecimal.ZERO) != 0) {
                    throw new InvalidPortionsException();
                }
            }
        }
    }

    private PlanDto toDto(Plan plan) {
        List<PlanFoodGroupDto> groups = toGroupDtos(plan.getFoodGroups());
        var meals = plan.getMeals().stream().map(meal -> {
            var portions = meal.getPortions().stream()
                .map(p -> new MealPortionDto(p.getFoodGroupId(), p.getPortions()))
                .toList();
            return new MealDto(meal.getId(), meal.getName(), meal.getSuggestedTime(), meal.getDisplayOrder(), portions);
        }).toList();
        return new PlanDto(groups, meals);
    }

    // ── API pública para módulos externos ─────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PlanFoodGroupDto> getPlanFoodGroups(Long planId) {
        return groupRepository.findByPlanIdOrderByDisplayOrderAsc(planId)
            .stream()
            .map(g -> new PlanFoodGroupDto(g.getId(), g.getName(), g.getAbbreviation(), g.getDisplayOrder(), g.getColor(), g.getClave(), g.isPreguntarSiFalta()))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<MealPortionSummary> getMealPortions(Long mealId) {
        return mealRepository.findById(mealId)
            .map(meal -> meal.getPortions().stream()
                .map(p -> new MealPortionSummary(p.getFoodGroupId(), p.getPortions()))
                .toList())
            .orElse(List.of());
    }

    @Transactional(readOnly = true)
    public String getModoRegistro(Long planId) {
        return plansRepository.findById(planId)
            .map(Plan::getModoRegistro)
            .orElse("PORCIONES");
    }

    @Transactional(readOnly = true)
    public BigDecimal getMargenPorciones(Long planId) {
        return plansRepository.findById(planId)
            .map(Plan::getMargenPorciones)
            .orElse(new BigDecimal("0.5"));
    }

    @Transactional(readOnly = true)
    public boolean mealBelongsToUser(Long mealId, Long userId) {
        return mealRepository.findByIdAndPlan_UserId(mealId, userId).isPresent();
    }

    // ── privados ──────────────────────────────────────────────────────────────

    private List<PlanFoodGroupDto> toGroupDtos(List<PlanFoodGroup> groups) {
        return groups.stream()
            .map(g -> new PlanFoodGroupDto(g.getId(), g.getName(), g.getAbbreviation(), g.getDisplayOrder(), g.getColor(), g.getClave(), g.isPreguntarSiFalta()))
            .toList();
    }
}
