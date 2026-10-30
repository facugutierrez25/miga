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

        Long planId = planService.getCurrentPlanId(userEmail);
        List<FoodRuleDto> rules = ruleService.findApplicable(planId, userId);

        MealNote note = noteRepository.findByUserIdAndDateAndMealId(userId, date, mealId)
            .orElseGet(() -> {
                MealNote n = new MealNote();
                n.setUserId(userId);
                n.setDate(date);
                n.setMealId(mealId);
                return n;
            });
        note.setText(text.strip());
        MealNote saved = noteRepository.save(note);

        entryFacade.deleteReglaEntries(saved.getId());

        List<InterpretedItem> items = interpreter.interpret(text, rules);
        List<InterpretedItem> expanded = expandCompound(items, rules, planId);

        for (InterpretedItem item : expanded) {
            if (!item.recognized() || item.foodGroupId() == null) continue;
            entryFacade.createNoteEntry(
                userEmail, mealId, date,
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
                s.foodGroupId(), s.name(), s.expected(), s.recorded(), s.status()
            )).toList()
        );
    }

    @Transactional(readOnly = true)
    DayComparisonDto getDayComparison(String userEmail, LocalDate date) {
        Long userId = userService.findUserIdByEmail(userEmail);
        Long planId = planService.getCurrentPlanId(userEmail);
        List<FoodRuleDto> rules = ruleService.findApplicable(planId, userId);

        List<FoodEntryFacade.EntryData> entries = entryFacade.findByUserEmailAndDate(userEmail, date);
        List<MealNote> notes = noteRepository.findByUserIdAndDate(userId, date);

        Map<Long, List<FoodEntryFacade.EntryData>> byMeal = entries.stream()
            .collect(Collectors.groupingBy(FoodEntryFacade.EntryData::mealId));

        List<MealComparisonDto> mealComparisons = new ArrayList<>();
        for (MealNote note : notes) {
            List<FoodEntryFacade.EntryData> mealEntries = byMeal.getOrDefault(note.getMealId(), List.of());
            Map<Long, BigDecimal> portionsByGroup = mealEntries.stream()
                .filter(e -> e.foodGroupId() != null && e.portions() != null)
                .collect(Collectors.groupingBy(
                    FoodEntryFacade.EntryData::foodGroupId,
                    Collectors.reducing(BigDecimal.ZERO,
                        FoodEntryFacade.EntryData::portions,
                        BigDecimal::add)
                ));
            List<ComparisonService.GroupStatus> statuses =
                comparison.compare(planId, note.getMealId(), portionsByGroup);
            mealComparisons.add(new MealComparisonDto(note.getMealId(), statuses.stream()
                .map(s -> new GroupStatusDto(s.foodGroupId(), s.name(), s.expected(), s.recorded(), s.status()))
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
                    Long groupId = resolveGroupId(comp.standardGroupKey(), planId);
                    if (groupId == null) continue;
                    result.add(new InterpretedItem(
                        item.originalText(), item.foodName(),
                        item.quantity(), item.unit(),
                        groupId, comp.standardGroupKey(),
                        BigDecimal.valueOf(comp.porciones()).multiply(item.quantity()).setScale(3, java.math.RoundingMode.HALF_UP),
                        item.appliedRule(), item.uncertain(), item.ruleId(), null
                    ));
                }
            } else if (item.recognized() && item.foodGroupId() == null && item.standardGroupKey() != null) {
                // Resolve foodGroupId via plan clave for GLOBAL rules
                Long groupId = resolveGroupId(item.standardGroupKey(), planId);
                result.add(new InterpretedItem(
                    item.originalText(), item.foodName(),
                    item.quantity(), item.unit(),
                    groupId, item.standardGroupKey(),
                    item.portions(), item.appliedRule(), item.uncertain(), item.ruleId(), null
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

    private InterpretedItemDto toItemDto(InterpretedItem item) {
        return new InterpretedItemDto(
            item.originalText(), item.foodName(),
            item.quantity(), item.unit(),
            item.foodGroupId(), item.portions(),
            item.appliedRule(), item.uncertain(), item.recognized()
        );
    }
}
