package uy.miga.registro;

import uy.miga.intake.EntryOrigin;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uy.miga.intake.FoodEntryFacade;
import uy.miga.plans.PlanService;
import uy.miga.reglas.FoodRuleDto;
import uy.miga.reglas.FoodRuleService;
import uy.miga.users.UserService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import java.time.temporal.ChronoUnit;
import uy.miga.plans.PlanNotFoundException;
import uy.miga.plans.PlanReadData;

@Service
class DayReadService {
    private final MealNoteRepository noteRepository;
    private final InterpreterService interpreter;
    private final FoodRuleService ruleService;
    private final ComparisonService comparison;
    private final FoodEntryFacade entryFacade;
    private final PlanService planService;
    private final UserService userService;
    private final DailyLogSupport support;

    DayReadService(MealNoteRepository noteRepository, InterpreterService interpreter, FoodRuleService ruleService,
            ComparisonService comparison, FoodEntryFacade entryFacade, PlanService planService, UserService userService,
            DailyLogSupport support) {
        this.noteRepository = noteRepository;
        this.interpreter = interpreter;
        this.ruleService = ruleService;
        this.comparison = comparison;
        this.entryFacade = entryFacade;
        this.planService = planService;
        this.userService = userService;
        this.support = support;
    }

    @Transactional(readOnly = true)
    public Map<LocalDate, List<WeekMealData>> getWeekMealsForRange(Long userId, LocalDate start, LocalDate end,
            Map<LocalDate, PlanReadData> plans, List<FoodEntryFacade.EntryData> entries) {
        var entriesByDate = entries.stream().collect(Collectors.groupingBy(FoodEntryFacade.EntryData::date));
        var notesByDate = noteRepository.findByUserIdAndDateBetween(userId, start, end).stream()
            .collect(Collectors.groupingBy(MealNote::getDate));
        Map<Long, List<FoodRuleDto>> rules = new HashMap<>();
        Map<LocalDate, List<WeekMealData>> result = new LinkedHashMap<>();
        plans.forEach((date, plan) -> {
            var notes = notesByDate.getOrDefault(date, List.of());
            var byMeal = notes.stream().collect(Collectors.toMap(MealNote::getMealId, n -> n));
            var day = buildDay(date, plan, entriesByDate.getOrDefault(date, List.of()), notes, rules);
            var names = plan.meals().stream().collect(Collectors.toMap(PlanReadData.MealData::id,
                PlanReadData.MealData::name));
            var applies = plan.meals().stream().collect(Collectors.toMap(PlanReadData.MealData::id,
                m -> m.appliesOn(date.getDayOfWeek())));
            // Una comida que no toca ese día se omite, salvo que ya tenga algo anotado.
            result.put(date, day.meals().stream().filter(meal -> applies.getOrDefault(meal.mealId(), true)
                || (byMeal.get(meal.mealId()) != null && !byMeal.get(meal.mealId()).getText().isBlank())
                || !meal.items().isEmpty()).map(meal -> {
                return weekMeal(meal, byMeal.get(meal.mealId()), names.get(meal.mealId()), plan, date, rules);
            }).toList());
        });
        return result;
    }

    static final int MAX_RANGE_DAYS = 366;

    @Transactional(readOnly = true)
    public List<WeekMealData> getWeekMeals(String email, LocalDate date) {
        Long userId = userService.findUserIdByEmail(email);
        var plans = planService.getPlansForRange(userId, date, date);
        if (!plans.containsKey(date)) throw new PlanNotFoundException();
        return getWeekMealsForRange(userId, date, date, plans,
            entryFacade.findByUserIdAndDate(userId, date)).get(date);
    }

    @Transactional(readOnly = true)
    DayComparisonDto getDayComparison(String userEmail, LocalDate date) {
        Long userId = userService.findUserIdByEmail(userEmail);
        Long planId = planService.getPlanIdForDate(userId, date);

        List<FoodEntryFacade.EntryData> entries = entryFacade.findByUserIdAndDate(userId, date);
        Map<Long, List<FoodEntryFacade.EntryData>> byMeal = entries.stream()
            .collect(Collectors.groupingBy(FoodEntryFacade.EntryData::mealId));

        // Todas las comidas del plan: no tener nota no confirma un consumo de cero.
        var plan = planService.getReadData(planId);
        var planMealIds = plan.meals().stream().map(PlanReadData.MealData::id).toList();

        List<MealComparisonDto> mealComparisons = new ArrayList<>();
        for (Long mealId : planMealIds) {
            List<FoodEntryFacade.EntryData> mealEntries = byMeal.getOrDefault(mealId, List.of());
            Map<Long, BigDecimal> portionsByGroup = mealEntries.stream()
                .filter(e -> e.foodGroupId() != null && e.portions() != null)
                .collect(Collectors.groupingBy(
                    FoodEntryFacade.EntryData::foodGroupId,
                    Collectors.reducing(BigDecimal.ZERO,
                        FoodEntryFacade.EntryData::portions,
                        BigDecimal::add)
                ));
            List<ComparisonService.GroupStatus> statuses =
                comparison.compare(plan, mealId, portionsByGroup);
            mealComparisons.add(new MealComparisonDto(mealId, statuses.stream()
                .map(s -> new GroupStatusDto(
                    s.foodGroupId(), s.name(), s.expected(), s.recorded(), s.status()))
                .toList()));
        }
        return new DayComparisonDto(date, mealComparisons);
    }

    @Transactional(readOnly = true)
    DayLogDto getDayLog(String userEmail, LocalDate date) {
        Long userId = userService.findUserIdByEmail(userEmail);
        Long planId = planService.getPlanIdForDate(userId, date);

        List<FoodEntryFacade.EntryData> entries = entryFacade.findByUserIdAndDate(userId, date);
        return buildDay(date, planService.getReadData(planId), entries,
            noteRepository.findByUserIdAndDate(userId, date), new HashMap<>());
    }

    DayLogDto.MealDayDto getMealLog(String email, LocalDate date, Long mealId) {
        return getDayLog(email, date).meals().stream()
            .filter(meal -> meal.mealId().equals(mealId)).findFirst().orElseThrow();
    }

    @Transactional(readOnly = true)
    DayLogDto.MealDayDto getMealLog(String email, LocalDate date, Long mealId, Long planId) {
        Long userId = userService.findUserIdByEmail(email);
        return buildDay(date, planService.getReadData(planId), entryFacade.findByUserIdAndDate(userId, date),
            noteRepository.findByUserIdAndDate(userId, date), new HashMap<>()).meals().stream()
            .filter(meal -> meal.mealId().equals(mealId)).findFirst().orElseThrow();
    }

    private DayLogDto buildDay(LocalDate date, PlanReadData plan,
                                    List<FoodEntryFacade.EntryData> entries, List<MealNote> notes, Map<Long, List<FoodRuleDto>> rules) {
        var byMeal = entries.stream().collect(Collectors.groupingBy(FoodEntryFacade.EntryData::mealId));
        var noteByMeal = notes.stream().collect(Collectors.toMap(MealNote::getMealId, n -> n));
        var planMealIds = plan.meals().stream().map(PlanReadData.MealData::id).toList();
        var groups = plan.groups();

        Map<Long, BigDecimal> totalByGroup = new HashMap<>();
        List<DayLogDto.MealDayDto> mealDtos = new ArrayList<>();

        for (Long mealId : planMealIds) {
            mealDtos.add(buildMeal(plan, mealId, noteByMeal.get(mealId),
                byMeal.getOrDefault(mealId, List.of()), totalByGroup, rules));
        }

        List<DayLogDto.DailySummaryDto> summary = groups.stream()
            .map(g -> new DayLogDto.DailySummaryDto(
                g.id(), g.name(), g.standardKey(),
                totalByGroup.getOrDefault(g.id(), BigDecimal.ZERO)))
            .toList();

        return new DayLogDto(date, mealDtos, summary);
    }

    // Lo que la persona escribió y no se reconoció en el rango, en orden de fecha.
    @Transactional(readOnly = true)
    public List<UnmatchedFoodDto> getUnmatchedFoods(Long userId, LocalDate from, LocalDate to) {
        validateRange(from, to);
        var unknown = entryFacade.findByUserIdAndDateRange(userId, from, to).stream()
            .filter(e -> EntryOrigin.UNKNOWN.equals(e.origin()))
            .sorted(Comparator.comparing(FoodEntryFacade.EntryData::date))
            .toList();
        if (unknown.isEmpty()) return List.of();
        Map<Long, String> names = planService.getMealNames(
            unknown.stream().map(FoodEntryFacade.EntryData::mealId).collect(Collectors.toSet()));
        return unknown.stream().map(e -> new UnmatchedFoodDto(
            e.originalText() != null && !e.originalText().isBlank() ? e.originalText() : e.food(),
            e.date(), names.getOrDefault(e.mealId(), ""))).toList();
    }

    @Transactional(readOnly = true)
    List<UnmatchedFoodDto> getUnmatchedFoods(String userEmail, LocalDate from, LocalDate to) {
        validateRange(from, to);
        return getUnmatchedFoods(userService.findUserIdByEmail(userEmail), from, to);
    }

    private static void validateRange(LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from)
            || ChronoUnit.DAYS.between(from, to) >= MAX_RANGE_DAYS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Elegí un rango de hasta " + MAX_RANGE_DAYS + " días.");
        }
    }

    private WeekMealData weekMeal(DayLogDto.MealDayDto meal, MealNote note, String mealName, PlanReadData plan,
            LocalDate date, Map<Long, List<FoodRuleDto>> rules) {
        long flexible = flexibleCount(meal.items(), note, plan.id(), rules);
        boolean planned = plan.meals().stream().anyMatch(m -> m.id().equals(meal.mealId())
            && m.appliesOn(date.getDayOfWeek()) && m.portions().stream().anyMatch(p -> p.portions().signum() > 0));
        return new WeekMealData(meal.mealId(), mealName, meal.noteText(), meal.status(), flexible, planned);
    }

    private long flexibleCount(List<DayLogDto.EntryItemDto> items, MealNote note, Long planId,
            Map<Long, List<FoodRuleDto>> rules) {
        var noteItems = items.stream().filter(item -> !EntryOrigin.RESPONSE.equals(item.origin())).toList();
        if (noteItems.stream().anyMatch(item -> item.ruleType() != null)) {
            return noteItems.stream().filter(item -> "FLEXIBLE".equals(item.ruleType()))
                .map(item -> item.occurrenceId() != null ? (Object) item.occurrenceId() : item.id())
                .distinct().count();
        }
        if (note == null || note.getText().isBlank()) return 0;
        Long notePlan = note.getPlanId() != null ? note.getPlanId() : planId;
        return interpreter.interpret(note.getText(), rules.computeIfAbsent(notePlan,
            id -> ruleService.findApplicable(id, note.getUserId()))).stream()
            .filter(item -> "FLEXIBLE".equals(item.type())).count();
    }

    private DayLogDto.MealDayDto buildMeal(PlanReadData plan, Long mealId, MealNote note,
            List<FoodEntryFacade.EntryData> mealEntries, Map<Long, BigDecimal> totalByGroup,
            Map<Long, List<FoodRuleDto>> rules) {

        List<DayLogDto.EntryItemDto> itemDtos = mealEntries.stream()
            .map(support::toEntryItemDto)
            .toList();

        mealEntries.stream()
            .filter(e -> e.foodGroupId() != null && e.portions() != null)
            .forEach(e -> totalByGroup.merge(e.foodGroupId(), e.portions(), BigDecimal::add));

        Map<Long, BigDecimal> portionsByGroup = mealEntries.stream()
            .filter(e -> e.foodGroupId() != null && e.portions() != null)
            .collect(Collectors.groupingBy(FoodEntryFacade.EntryData::foodGroupId,
                Collectors.reducing(BigDecimal.ZERO, FoodEntryFacade.EntryData::portions, BigDecimal::add)));

        List<ComparisonService.GroupStatus> statuses = comparison.compare(plan, mealId, portionsByGroup);
        List<GroupStatusDto> compDtos = statuses.stream()
            .map(s -> new GroupStatusDto(
                s.foodGroupId(), s.name(), s.expected(), s.recorded(), s.status()))
            .toList();

        return new DayLogDto.MealDayDto(
            mealId,
            note != null ? note.getId() : null,
            note != null ? note.getText() : null,
            note != null ? note.getVersion() : null,
            itemDtos,
            compDtos,
            ComparisonService.mealStatus((note != null && !note.getText().isBlank()) || !itemDtos.isEmpty(),
                itemDtos.stream().anyMatch(item -> "FLEXIBLE".equals(item.ruleType()))
                    || flexibleCount(itemDtos, note, plan.id(), rules) > 0, compDtos)
        );
    }
}
