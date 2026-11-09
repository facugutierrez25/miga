package uy.miga.registro;

import uy.miga.intake.EntryOrigin;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uy.miga.intake.FoodEntryFacade;
import uy.miga.plans.PlanService;
import uy.miga.reglas.FoodRuleDto;
import uy.miga.reglas.ReglaService;
import uy.miga.users.UserService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
class DayReadService {
    private final MealNoteRepository noteRepository;
    private final InterpreterService interpreter;
    private final ReglaService ruleService;
    private final ComparisonService comparison;
    private final FoodEntryFacade entryFacade;
    private final PlanService planService;
    private final UserService userService;
    private final RegistroSupport support;

    DayReadService(MealNoteRepository noteRepository, InterpreterService interpreter, ReglaService ruleService,
            ComparisonService comparison, FoodEntryFacade entryFacade, PlanService planService, UserService userService,
            RegistroSupport support) {
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
            Map<LocalDate, uy.miga.plans.PlanReadData> plans, List<FoodEntryFacade.EntryData> entries) {
        var entriesByDate = entries.stream().collect(Collectors.groupingBy(FoodEntryFacade.EntryData::date));
        var notesByDate = noteRepository.findByUserIdAndDateBetween(userId, start, end).stream()
            .collect(Collectors.groupingBy(MealNote::getDate));
        Map<Long, List<FoodRuleDto>> rules = new HashMap<>();
        Map<LocalDate, List<WeekMealData>> result = new LinkedHashMap<>();
        plans.forEach((date, plan) -> {
            var notes = notesByDate.getOrDefault(date, List.of());
            var byMeal = notes.stream().collect(Collectors.toMap(MealNote::getMealId, n -> n));
            var day = buildDay(date, plan, entriesByDate.getOrDefault(date, List.of()), notes);
            var names = plan.meals().stream().collect(Collectors.toMap(uy.miga.plans.PlanReadData.MealData::id,
                uy.miga.plans.PlanReadData.MealData::name));
            var applies = plan.meals().stream().collect(Collectors.toMap(uy.miga.plans.PlanReadData.MealData::id,
                m -> m.appliesOn(date.getDayOfWeek())));
            // Una comida que no toca ese día se omite, salvo que ya tenga algo anotado.
            result.put(date, day.meals().stream().filter(meal -> applies.getOrDefault(meal.mealId(), true)
                || (byMeal.get(meal.mealId()) != null && !byMeal.get(meal.mealId()).getText().isBlank())
                || !meal.items().isEmpty()).map(meal -> {
                return weekMeal(meal, byMeal.get(meal.mealId()), names.get(meal.mealId()), plan.id(), userId, rules);
            }).toList());
        });
        return result;
    }

    static final int MAX_RANGE_DAYS = 366;

    @Transactional(readOnly = true)
    public List<WeekMealData> getWeekMeals(String email, LocalDate date) {
        Long userId = userService.findUserIdByEmail(email);
        var plans = planService.getPlansForRange(userId, date, date);
        if (!plans.containsKey(date)) throw new uy.miga.plans.PlanNotFoundException();
        return getWeekMealsForRange(userId, date, date, plans,
            entryFacade.findByUserIdAndDate(userId, date)).get(date);
    }

    // Estado de una comida con registro: un grupo sin porciones no la vuelve «sin anotar»,
    // cuenta como «casi»; si algún grupo se pasa, el estado es «de más».
    private static String recordedMealStatus(List<GroupStatusDto> groups) {
        if (groups.isEmpty()) return "REGISTRADA";
        List<String> statuses = groups.stream().map(GroupStatusDto::status).toList();
        if (statuses.contains(ComparisonService.OVER)) return ComparisonService.OVER;
        if (statuses.contains(ComparisonService.CLOSE) || statuses.contains(ComparisonService.MISSING)) {
            return ComparisonService.CLOSE;
        }
        if (statuses.contains(ComparisonService.ASK)) return ComparisonService.ASK;
        return ComparisonService.ON_PLAN;
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
        var planMealIds = plan.meals().stream().map(uy.miga.plans.PlanReadData.MealData::id).toList();

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
    DayRegistroDto getDayRegistro(String userEmail, LocalDate date) {
        Long userId = userService.findUserIdByEmail(userEmail);
        Long planId = planService.getPlanIdForDate(userId, date);

        List<FoodEntryFacade.EntryData> entries = entryFacade.findByUserIdAndDate(userId, date);
        return buildDay(date, planService.getReadData(planId), entries,
            noteRepository.findByUserIdAndDate(userId, date));
    }

    private DayRegistroDto buildDay(LocalDate date, uy.miga.plans.PlanReadData plan,
                                    List<FoodEntryFacade.EntryData> entries, List<MealNote> notes) {
        var byMeal = entries.stream().collect(Collectors.groupingBy(FoodEntryFacade.EntryData::mealId));
        var noteByMeal = notes.stream().collect(Collectors.toMap(MealNote::getMealId, n -> n));
        var planMealIds = plan.meals().stream().map(uy.miga.plans.PlanReadData.MealData::id).toList();
        var groups = plan.groups();

        Map<Long, BigDecimal> totalByGroup = new HashMap<>();
        List<DayRegistroDto.MealDayDto> mealDtos = new ArrayList<>();

        for (Long mealId : planMealIds) {
            mealDtos.add(buildMeal(plan, mealId, noteByMeal.get(mealId),
                byMeal.getOrDefault(mealId, List.of()), totalByGroup));
        }

        List<DayRegistroDto.DailySummaryDto> summary = groups.stream()
            .map(g -> new DayRegistroDto.DailySummaryDto(
                g.id(), g.name(), g.clave(),
                totalByGroup.getOrDefault(g.id(), BigDecimal.ZERO)))
            .toList();

        return new DayRegistroDto(date, mealDtos, summary);
    }

    // Lo que la persona escribió y no se reconoció en el rango, en orden de fecha.
    @Transactional(readOnly = true)
    public List<SinReglaDto> getSinRegla(Long userId, LocalDate desde, LocalDate hasta) {
        validateRange(desde, hasta);
        var unknown = entryFacade.findByUserIdAndDateRange(userId, desde, hasta).stream()
            .filter(e -> EntryOrigin.UNKNOWN.equals(e.origin()))
            .sorted(Comparator.comparing(FoodEntryFacade.EntryData::date))
            .toList();
        if (unknown.isEmpty()) return List.of();
        Map<Long, String> names = planService.getMealNames(
            unknown.stream().map(FoodEntryFacade.EntryData::mealId).collect(Collectors.toSet()));
        return unknown.stream().map(e -> new SinReglaDto(
            e.originalText() != null && !e.originalText().isBlank() ? e.originalText() : e.food(),
            e.date(), names.getOrDefault(e.mealId(), ""))).toList();
    }

    @Transactional(readOnly = true)
    List<SinReglaDto> getSinRegla(String userEmail, LocalDate desde, LocalDate hasta) {
        validateRange(desde, hasta);
        return getSinRegla(userService.findUserIdByEmail(userEmail), desde, hasta);
    }

    private static void validateRange(LocalDate desde, LocalDate hasta) {
        if (desde == null || hasta == null || hasta.isBefore(desde)
            || java.time.temporal.ChronoUnit.DAYS.between(desde, hasta) >= MAX_RANGE_DAYS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Elegí un rango de hasta " + MAX_RANGE_DAYS + " días.");
        }
    }

    private WeekMealData weekMeal(DayRegistroDto.MealDayDto meal, MealNote note, String mealName, Long planId,
            Long userId, Map<Long, List<FoodRuleDto>> rules) {
        long flexible = 0;
        if (note != null && !note.getText().isBlank()) {
            // Los alimentos se editan en el lugar: se cuenta con el tipo guardado en cada ítem.
            // Solo los registros anteriores a rule_type se reinterpretan.
            var noteItems = meal.items().stream().filter(item -> !EntryOrigin.RESPONSE.equals(item.origin())).toList();
            if (noteItems.stream().anyMatch(item -> item.ruleType() != null)) {
                flexible = noteItems.stream().filter(item -> "FLEXIBLE".equals(item.ruleType())).count();
            } else {
                Long notePlan = note.getPlanId() != null ? note.getPlanId() : planId;
                flexible = interpreter.interpret(note.getText(), rules.computeIfAbsent(notePlan,
                    id -> ruleService.findApplicable(id, userId))).stream()
                    .filter(item -> "FLEXIBLE".equals(item.tipo())).count();
            }
        }
        String status = (note != null && !note.getText().isBlank()) || !meal.items().isEmpty()
            ? recordedMealStatus(meal.comparison()) : ComparisonService.MISSING;
        return new WeekMealData(meal.mealId(), mealName, meal.noteText(), status, flexible);
    }

    private DayRegistroDto.MealDayDto buildMeal(uy.miga.plans.PlanReadData plan, Long mealId, MealNote note,
            List<FoodEntryFacade.EntryData> mealEntries, Map<Long, BigDecimal> totalByGroup) {

        List<DayRegistroDto.EntryItemDto> itemDtos = mealEntries.stream()
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

        return new DayRegistroDto.MealDayDto(
            mealId,
            note != null ? note.getId() : null,
            note != null ? note.getText() : null,
            note != null ? note.getVersion() : null,
            itemDtos,
            compDtos
        );
    }
}
