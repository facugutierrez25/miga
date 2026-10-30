package uy.miga.registro;

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
class RegistroService {

    private final MealNoteRepository noteRepository;
    private final InterpreterService interpreter;
    private final ComparisonService comparison;
    private final FoodEntryFacade entryFacade;
    private final PlanService planService;
    private final ReglaService ruleService;
    private final UserService userService;

    RegistroService(MealNoteRepository noteRepository,
                    InterpreterService interpreter,
                    ComparisonService comparison,
                    FoodEntryFacade entryFacade,
                    PlanService planService,
                    ReglaService ruleService,
                    UserService userService) {
        this.noteRepository = noteRepository;
        this.interpreter    = interpreter;
        this.comparison     = comparison;
        this.entryFacade    = entryFacade;
        this.planService    = planService;
        this.ruleService    = ruleService;
        this.userService    = userService;
    }

    @Transactional(readOnly = true)
    NoteDto getNote(String userEmail, LocalDate date, Long mealId) {
        Long userId = userService.findUserIdByEmail(userEmail);
        return noteRepository.findByUserIdAndDateAndMealId(userId, date, mealId)
            .map(n -> new NoteDto(n.getId(), n.getMealId(), n.getDate(), n.getText()))
            .orElse(null);
    }

    @Transactional
    NoteInterpretationDto saveNote(String userEmail, LocalDate date, Long mealId, String text) {
        Long userId = userService.findUserIdByEmail(userEmail);

        if (!planService.mealBelongsToUser(mealId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        MealNote note = noteRepository.findByUserIdAndDateAndMealId(userId, date, mealId)
            .orElseGet(() -> {
                MealNote n = new MealNote();
                n.setUserId(userId);
                n.setDate(date);
                n.setMealId(mealId);
                return n;
            });

        Long planId = note.getPlanId() != null
            ? note.getPlanId()
            : planService.getPlanIdForDate(userId, date);

        if (note.getPlanId() == null) {
            note.setPlanId(planId);
        }

        List<FoodRuleDto> rules = ruleService.findApplicable(planId, userId);

        note.setText(text.strip());
        MealNote saved = noteRepository.save(note);

        entryFacade.deleteReglaEntries(saved.getId());

        List<InterpretedItem> items = interpreter.interpret(text, rules);
        List<InterpretedItem> expanded = expandCompound(items, rules, planId);

        for (InterpretedItem item : expanded) {
            if (!item.recognized() || item.foodGroupId() == null) continue;
            entryFacade.createNoteEntry(
                userId, userEmail, mealId, date,
                item.foodName(),
                item.quantity().doubleValue(),
                item.unit(),
                item.foodGroupId(),
                saved.getId(),
                item.originalText(),
                item.uncertain(),
                item.portions()
            );
        }

        Map<Long, BigDecimal> portionsByGroup = buildPortionMap(expanded);
        List<ComparisonService.GroupStatus> statuses = comparison.compare(planId, mealId, portionsByGroup);

        return new NoteInterpretationDto(
            saved.getId(), text, date, mealId,
            items.stream().map(this::toItemDto).toList(),
            statuses.stream().map(s -> new GroupStatusDto(
                s.foodGroupId(), s.name(), s.expected(), s.recorded(), s.status(), s.dailyGoal()
            )).toList()
        );
    }

    @Transactional(readOnly = true)
    DayComparisonDto getDayComparison(String userEmail, LocalDate date) {
        Long userId = userService.findUserIdByEmail(userEmail);
        Long planId = planService.getPlanIdForDate(userId, date);

        List<FoodEntryFacade.EntryData> entries = entryFacade.findByUserIdAndDate(userId, date);
        Map<Long, List<FoodEntryFacade.EntryData>> byMeal = entries.stream()
            .collect(Collectors.groupingBy(FoodEntryFacade.EntryData::mealId));

        // All plan meals — not only those with a note (absence of note ≠ zero confirmed)
        List<Long> planMealIds = planService.getMealIds(planId);

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
                comparison.compare(planId, mealId, portionsByGroup);
            mealComparisons.add(new MealComparisonDto(mealId, statuses.stream()
                .map(s -> new GroupStatusDto(
                    s.foodGroupId(), s.name(), s.expected(), s.recorded(), s.status(), s.dailyGoal()))
                .toList()));
        }
        return new DayComparisonDto(date, mealComparisons);
    }

    private List<InterpretedItem> expandCompound(List<InterpretedItem> items,
                                                  List<FoodRuleDto> rules,
                                                  Long planId) {
        List<InterpretedItem> result = new ArrayList<>();
        for (InterpretedItem item : items) {
            if ("COMPUESTO".equals(getType(item, rules)) && item.components() != null) {
                // Expand each component, mapping to plan food group via standardGroupKey → clave
                for (var comp : item.components()) {
                    Long groupId = comp.foodGroupId() != null ? comp.foodGroupId()
                        : resolveGroupId(comp.standardGroupKey(), planId);
                    if (groupId == null) continue;
                    result.add(new InterpretedItem(
                        item.originalText(), item.foodName(),
                        item.quantity(), item.unit(),
                        groupId, comp.standardGroupKey(),
                        BigDecimal.valueOf(comp.porciones()).multiply(item.quantity()).setScale(3, java.math.RoundingMode.HALF_UP),
                        item.appliedRule(), item.uncertain(), item.ruleId(), null, null
                    ));
                }
            } else if (item.recognized() && item.foodGroupId() == null && item.standardGroupKey() != null) {
                // Resolve foodGroupId via plan clave for GLOBAL rules
                Long groupId = resolveGroupId(item.standardGroupKey(), planId);
                result.add(new InterpretedItem(
                    item.originalText(), item.foodName(),
                    item.quantity(), item.unit(),
                    groupId, item.standardGroupKey(),
                    item.portions(), item.appliedRule(), item.uncertain(), item.ruleId(), null, item.tipo()
                ));
            } else {
                result.add(item);
            }
        }
        return result;
    }

    private String getType(InterpretedItem item, List<FoodRuleDto> rules) {
        if (item.ruleId() == null) return "NORMAL";
        return rules.stream().filter(r -> r.id().equals(item.ruleId()))
            .findFirst().map(FoodRuleDto::tipo).orElse("NORMAL");
    }

    private Long resolveGroupId(String standardGroupKey, Long planId) {
        return planService.findGroupIdByClave(planId, standardGroupKey);
    }

    private Map<Long, BigDecimal> buildPortionMap(List<InterpretedItem> items) {
        Map<Long, BigDecimal> map = new HashMap<>();
        for (InterpretedItem item : items) {
            if (!item.recognized() || item.foodGroupId() == null || item.portions() == null) continue;
            map.merge(item.foodGroupId(), item.portions(), BigDecimal::add);
        }
        return map;
    }

    @Transactional(readOnly = true)
    DayRegistroDto getDayRegistro(String userEmail, LocalDate date) {
        Long userId = userService.findUserIdByEmail(userEmail);
        Long planId = planService.getPlanIdForDate(userId, date);

        List<FoodEntryFacade.EntryData> entries = entryFacade.findByUserIdAndDate(userId, date);
        Map<Long, List<FoodEntryFacade.EntryData>> byMeal = entries.stream()
            .collect(Collectors.groupingBy(FoodEntryFacade.EntryData::mealId));
        Map<Long, MealNote> noteByMeal = noteRepository.findByUserIdAndDate(userId, date)
            .stream().collect(Collectors.toMap(MealNote::getMealId, n -> n));

        List<Long> planMealIds = planService.getMealIds(planId);
        List<uy.miga.plans.PlanFoodGroupDto> groups = planService.getPlanFoodGroups(planId);
        Map<Long, uy.miga.plans.PlanFoodGroupDto> groupById = groups.stream()
            .collect(Collectors.toMap(uy.miga.plans.PlanFoodGroupDto::id, g -> g));

        Map<Long, BigDecimal> totalByGroup = new HashMap<>();
        List<DayRegistroDto.MealDayDto> mealDtos = new ArrayList<>();

        for (Long mealId : planMealIds) {
            MealNote note = noteByMeal.get(mealId);
            List<FoodEntryFacade.EntryData> mealEntries = byMeal.getOrDefault(mealId, List.of());

            List<DayRegistroDto.EntryItemDto> itemDtos = mealEntries.stream()
                .map(e -> new DayRegistroDto.EntryItemDto(
                    e.id(), e.food(), e.quantity(), e.unit(),
                    e.foodGroupId(), e.portions(), e.origin(), e.uncertain()))
                .toList();

            mealEntries.stream()
                .filter(e -> e.foodGroupId() != null && e.portions() != null)
                .forEach(e -> totalByGroup.merge(e.foodGroupId(), e.portions(), BigDecimal::add));

            Map<Long, BigDecimal> portionsByGroup = mealEntries.stream()
                .filter(e -> e.foodGroupId() != null && e.portions() != null)
                .collect(Collectors.groupingBy(FoodEntryFacade.EntryData::foodGroupId,
                    Collectors.reducing(BigDecimal.ZERO, FoodEntryFacade.EntryData::portions, BigDecimal::add)));

            List<ComparisonService.GroupStatus> statuses = comparison.compare(planId, mealId, portionsByGroup);
            List<GroupStatusDto> compDtos = statuses.stream()
                .map(s -> new GroupStatusDto(
                    s.foodGroupId(), s.name(), s.expected(), s.recorded(), s.status(), s.dailyGoal()))
                .toList();

            mealDtos.add(new DayRegistroDto.MealDayDto(
                mealId,
                note != null ? note.getId() : null,
                note != null ? note.getText() : null,
                itemDtos,
                compDtos
            ));
        }

        List<DayRegistroDto.DailySummaryDto> summary = groups.stream()
            .map(g -> new DayRegistroDto.DailySummaryDto(
                g.id(), g.name(), g.clave(),
                totalByGroup.getOrDefault(g.id(), BigDecimal.ZERO),
                g.metaDiaria()))
            .toList();

        return new DayRegistroDto(date, mealDtos, summary);
    }

    @Transactional
    DayRegistroDto.EntryItemDto patchItem(String userEmail, LocalDate date, Long entryId,
                                          PatchItemRequest req) {
        Long userId = userService.findUserIdByEmail(userEmail);
        FoodEntryFacade.EntryData entry = entryFacade.findEntryByIdAndUserId(entryId, userId);
        if (entry == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);

        Double newQty = req.quantity() != null ? req.quantity().doubleValue() : null;
        entryFacade.updateEntry(entryId, newQty, req.unit(), req.foodGroupId(), req.portions());

        if (req.saveAsRule()) {
            Long planId = planService.getCurrentPlanId(userEmail);
            Long groupId = req.foodGroupId() != null ? req.foodGroupId() : entry.foodGroupId();
            ruleService.createUserRule(userId, planId, groupId,
                entry.food(), null,
                req.quantity(), req.unit(),
                req.portions());
        }

        FoodEntryFacade.EntryData updated = entryFacade.findEntryByIdAndUserId(entryId, userId);
        return new DayRegistroDto.EntryItemDto(
            updated.id(), updated.food(), updated.quantity(), updated.unit(),
            updated.foodGroupId(), updated.portions(), updated.origin(), updated.uncertain());
    }

    @Transactional
    void saveRespuesta(String userEmail, LocalDate date, Long mealId, RespuestaRequest req) {
        Long userId = userService.findUserIdByEmail(userEmail);
        if (!planService.mealBelongsToUser(mealId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        if (!req.consumed()) return; // negativa: no crear entrada

        Long planId = planService.getPlanIdForDate(userId, date);
        String food = planService.getPlanFoodGroups(planId).stream()
            .filter(g -> g.id().equals(req.foodGroupId()))
            .findFirst().map(uy.miga.plans.PlanFoodGroupDto::name).orElse("alimento");

        entryFacade.createUserEntry(userId, userEmail, mealId, date, food, req.foodGroupId());
    }

    @Transactional(readOnly = true)
    List<String> getSugerencias(String userEmail, Long mealId) {
        Long userId = userService.findUserIdByEmail(userEmail);
        return noteRepository.findTopTextsByUserIdAndMealId(userId, mealId);
    }

    private InterpretedItemDto toItemDto(InterpretedItem item) {
        return new InterpretedItemDto(
            item.originalText(), item.foodName(),
            item.quantity(), item.unit(),
            item.foodGroupId(), item.standardGroupKey(), item.portions(),
            item.appliedRule(), item.uncertain(), item.recognized(), item.tipo()
        );
    }
}
