package uy.miga.registro;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uy.miga.intake.FoodEntryFacade;
import uy.miga.plans.PlanService;
import uy.miga.reglas.FoodRuleDto;
import uy.miga.reglas.ReglaService;
import uy.miga.reglas.Componente;
import uy.miga.reglas.RuleInput;
import uy.miga.reglas.RuleText;
import uy.miga.users.UserService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RegistroService {
    @Transactional(readOnly = true)
    public List<WeekMealData> getWeekMeals(String email, LocalDate date) {
        Long userId = userService.findUserIdByEmail(email);
        Long planId = planService.getPlanIdForDate(userId, date);
        var day = getDayRegistro(email, date);
        var names = planService.getMeals(planId).stream()
            .collect(Collectors.toMap(PlanService.MealRef::id, PlanService.MealRef::name));
        var notes = noteRepository.findByUserIdAndDate(userId, date).stream()
            .collect(Collectors.toMap(MealNote::getMealId, n -> n));
        return day.meals().stream().map(meal -> {
            var note = notes.get(meal.mealId());
            long flexible = 0;
            if (note != null) {
                Long notePlan = note.getPlanId() != null ? note.getPlanId() : planId;
                flexible = interpreter.interpret(note.getText(), ruleService.findApplicable(notePlan, userId))
                    .stream().filter(item -> "FLEXIBLE".equals(item.tipo())).count();
            }
            String status = note != null || !meal.items().isEmpty()
                ? recordedMealStatus(meal.comparison())
                : ComparisonService.MISSING;
            return new WeekMealData(meal.mealId(), names.get(meal.mealId()), meal.noteText(), status, flexible);
        }).toList();
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
    public boolean planHasNotes(Long planId) { return noteRepository.existsByPlanId(planId); }

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
        return saveNote(userEmail, date, mealId, text, null, false);
    }

    @Transactional
    NoteInterpretationDto saveNote(String userEmail, LocalDate date, Long mealId, String text, Long version) {
        return saveNote(userEmail, date, mealId, text, version, true);
    }

    private NoteInterpretationDto saveNote(String userEmail, LocalDate date, Long mealId, String text,
                                            Long version, boolean checkVersion) {
        Long userId = userService.findUserIdByEmail(userEmail);
        lockCurrentPlanIfPresent(userId);

        if (!planService.mealBelongsToUser(mealId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        Optional<MealNote> existing = noteRepository.findByUserIdAndDateAndMealId(userId, date, mealId);
        if (checkVersion && (existing.isPresent()
            ? version == null || !version.equals(existing.get().getVersion())
            : version != null)) {
            throw new NoteConflictException();
        }
        MealNote note = existing.orElseGet(() -> {
            MealNote n = new MealNote();
            n.setUserId(userId);
            n.setDate(date);
            n.setMealId(mealId);
            return n;
        });

        Long planId = note.getPlanId() != null
            ? note.getPlanId()
            : planService.getPlanIdForDate(userId, date);

        if ((note.getPlanId() != null || date.equals(LocalDate.now()))
            && !planService.getMealIds(planId).contains(mealId)) {
            throw new uy.miga.plans.PlanVersionConflictException();
        }
        if (note.getPlanId() == null) {
            note.setPlanId(planId);
        }

        if (checkVersion && existing.isPresent() && text.strip().equals(note.getText())) {
            DayRegistroDto.MealDayDto meal = getDayRegistro(userEmail, date).meals().stream()
                .filter(m -> m.mealId().equals(mealId)).findFirst().orElseThrow();
            return new NoteInterpretationDto(note.getId(), note.getVersion(), note.getText(), date, mealId,
                List.of(), meal.items(), meal.comparison());
        }
        List<FoodRuleDto> rules = ruleService.findApplicable(planId, userId);

        note.setText(text.strip());
        MealNote saved = noteRepository.saveAndFlush(note);

        entryFacade.deleteNoteEntries(saved.getId());

        List<InterpretedItem> items = interpreter.interpret(text, rules);
        Map<Long, String> groupNames = planService.getPlanFoodGroups(planId).stream()
            .collect(Collectors.toMap(uy.miga.plans.PlanFoodGroupDto::id, uy.miga.plans.PlanFoodGroupDto::name));

        for (InterpretedItem mention : items) {
            UUID occurrenceId = UUID.randomUUID();
            String ruleText = describeRule(mention, rules, planId, groupNames);
            if (!mention.recognized() || Set.of("LIBRE", "FLEXIBLE", "NO_CUENTA").contains(mention.tipo())) {
                entryFacade.createMentionEntry(userId, userEmail, mealId, date, mention.foodName(),
                    mention.quantity().doubleValue(), mention.unit(), saved.getId(), mention.originalText(),
                    mention.recognized() && mention.uncertain(), ruleText, occurrenceId, mention.recognized());
                continue;
            }
            for (InterpretedItem item : expandCompound(List.of(mention), rules, planId)) {
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
                    item.portions(),
                    ruleText,
                    occurrenceId
                );
            }
        }

        List<FoodEntryFacade.EntryData> mealEntries = entryFacade.findByUserIdAndDate(userId, date).stream()
            .filter(e -> mealId.equals(e.mealId())).toList();
        Map<Long, BigDecimal> portionsByGroup = mealEntries.stream()
            .filter(e -> e.foodGroupId() != null && e.portions() != null)
            .collect(Collectors.groupingBy(FoodEntryFacade.EntryData::foodGroupId,
                Collectors.reducing(BigDecimal.ZERO, FoodEntryFacade.EntryData::portions, BigDecimal::add)));
        List<ComparisonService.GroupStatus> statuses = comparison.compare(planId, mealId, portionsByGroup);

        return new NoteInterpretationDto(
            saved.getId(), saved.getVersion(), saved.getText(), date, mealId,
            items.stream().map(this::toItemDto).toList(),
            mealEntries.stream().map(this::toEntryItemDto).toList(),
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

    // Texto legible de la regla aplicada, con los nombres de los grupos del plan.
    private String describeRule(InterpretedItem item, List<FoodRuleDto> rules, Long planId,
                                Map<Long, String> groupNames) {
        if (item.ruleId() == null) return null;
        FoodRuleDto rule = rules.stream().filter(r -> r.id().equals(item.ruleId())).findFirst().orElse(null);
        if (rule == null) return item.appliedRule();
        if (!"COMPUESTO".equals(rule.tipo())) {
            return rule.alcance().equals("GLOBAL") ? item.appliedRule() : RuleText.describe(rule, groupNames);
        }
        return "1 " + rule.alimento() + " = " + rule.componentes().stream()
            .map(c -> {
                Long groupId = c.foodGroupId() != null ? c.foodGroupId() : resolveGroupId(c.standardGroupKey(), planId);
                String name = groupId == null ? c.standardGroupKey() : groupNames.getOrDefault(groupId, c.standardGroupKey());
                return BigDecimal.valueOf(c.porciones()).stripTrailingZeros().toPlainString().replace('.', ',') + " " + name;
            })
            .collect(Collectors.joining(" + "));
    }

    private DayRegistroDto.EntryItemDto toEntryItemDto(FoodEntryFacade.EntryData e) {
        return new DayRegistroDto.EntryItemDto(
            e.id(), e.food(), e.quantity(), e.unit(), e.foodGroupId(), e.portions(), e.origin(),
            e.uncertain(), e.originalText(), e.appliedRule(), e.occurrenceId());
    }

    private String getType(InterpretedItem item, List<FoodRuleDto> rules) {
        if (item.ruleId() == null) return "NORMAL";
        return rules.stream().filter(r -> r.id().equals(item.ruleId()))
            .findFirst().map(FoodRuleDto::tipo).orElse("NORMAL");
    }

    private Long resolveGroupId(String standardGroupKey, Long planId) {
        return planService.findGroupIdByClave(planId, standardGroupKey);
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
                .map(this::toEntryItemDto)
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
                note != null ? note.getVersion() : null,
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
    PatchItemResultDto patchItem(String userEmail, LocalDate date, Long entryId, PatchItemRequest req) {
        Long userId = userService.findUserIdByEmail(userEmail);
        Long currentPlanId = lockCurrentPlanIfPresent(userId);
        FoodEntryFacade.EntryData entry = entryFacade.findEntryByIdAndUserId(entryId, userId);
        if (entry == null || !entry.date().equals(date)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (Set.of("MENTION", "UNKNOWN").contains(entry.origin() == null ? "" : entry.origin())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Esta mención no admite correcciones.");
        }
        if (req.grupos() != null && (req.foodGroupId() != null || req.portions() != null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Indicá un grupo o varios grupos, no ambos.");
        }

        Long planId = entryPlanId(userId, entry);
        if (!planService.getMealIds(planId).contains(entry.mealId())) {
            throw new uy.miga.plans.PlanVersionConflictException();
        }
        if (req.savesRule() && !planId.equals(currentPlanId)) {
            throw new uy.miga.plans.PlanVersionConflictException();
        }
        Set<Long> planGroups = planService.getPlanFoodGroups(planId).stream()
            .map(uy.miga.plans.PlanFoodGroupDto::id).collect(Collectors.toSet());
        List<Long> requestedGroups = req.grupos() != null
            ? req.grupos().stream().map(PatchItemRequest.GroupPortion::foodGroupId).toList()
            : (req.foodGroupId() != null ? List.of(req.foodGroupId()) : List.of());
        if (!planGroups.containsAll(requestedGroups)
            || new HashSet<>(requestedGroups).size() != requestedGroups.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Los grupos no pertenecen a tu plan.");
        }

        BigDecimal quantity = req.quantity() != null ? req.quantity() : BigDecimal.valueOf(entry.quantity());
        List<Long> resultIds;
        if (req.grupos() != null) {
            Map<Long, BigDecimal> portionsByGroup = new LinkedHashMap<>();
            req.grupos().forEach(g -> portionsByGroup.put(g.foodGroupId(), g.porciones()));
            resultIds = entryFacade.splitEntry(entryId, portionsByGroup);
            if (req.savesRule()) {
                List<Componente> components = req.grupos().stream()
                    .map(g -> new Componente(g.foodGroupId(), null,
                        g.porciones().divide(quantity, 3, RoundingMode.HALF_UP).doubleValue()))
                    .toList();
                ruleService.upsertUserRule(userId, planId, new RuleInput(entry.food(), List.of(), "COMPUESTO",
                    null, null, entry.unit(), BigDecimal.ONE, components, null));
            }
        } else {
            BigDecimal portions = req.portions() != null ? req.portions() : scaledPortions(entry, quantity);
            if (req.savesRule() && (portions == null || portions.signum() <= 0)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Para guardar como regla, indicá porciones mayores a cero");
            }
            entryFacade.correctEntry(entryId, quantity.doubleValue(), req.unit(), req.foodGroupId(), portions);
            resultIds = List.of(entryId);
            if (req.savesRule()) {
                Long groupId = req.foodGroupId() != null ? req.foodGroupId() : entry.foodGroupId();
                ruleService.upsertUserRule(userId, planId, new RuleInput(entry.food(), List.of(), "NORMAL",
                    groupId, quantity.divide(portions, 3, RoundingMode.HALF_UP),
                    req.unit() != null ? req.unit() : entry.unit(),
                    portions.divide(quantity, 3, RoundingMode.HALF_UP), List.of(), null));
            }
        }

        if (req.savesRule()) {
            planService.bumpVersion(planId);
        }
        List<DayRegistroDto.EntryItemDto> items = resultIds.stream()
            .map(id -> toEntryItemDto(entryFacade.findEntryByIdAndUserId(id, userId)))
            .toList();
        return new PatchItemResultDto(List.of(entryId), items);
    }

    // Al cambiar solo la cantidad, las porciones se ajustan en la misma proporción.
    private BigDecimal scaledPortions(FoodEntryFacade.EntryData entry, BigDecimal quantity) {
        if (entry.portions() == null || entry.quantity() == null || entry.quantity() <= 0) return entry.portions();
        return entry.portions().multiply(quantity)
            .divide(BigDecimal.valueOf(entry.quantity()), 3, RoundingMode.HALF_UP);
    }

    private Long entryPlanId(Long userId, FoodEntryFacade.EntryData entry) {
        if (entry.mealNoteId() != null) {
            Long notePlan = noteRepository.findById(entry.mealNoteId()).map(MealNote::getPlanId).orElse(null);
            if (notePlan != null) return notePlan;
        }
        return planService.getPlanIdForDate(userId, entry.date());
    }

    // Borra la nota de una comida y todo lo registrado en ella ese día. Exige la versión vigente,
    // igual que al guardar, para no borrar cambios hechos en otro dispositivo.
    @Transactional
    void deleteNote(String userEmail, LocalDate date, Long mealId, Long version) {
        Long userId = userService.findUserIdByEmail(userEmail);
        lockCurrentPlanIfPresent(userId);
        if (!planService.mealBelongsToUser(mealId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        Optional<MealNote> existing = noteRepository.findByUserIdAndDateAndMealId(userId, date, mealId);
        if (existing.isPresent()
            ? version == null || !version.equals(existing.get().getVersion())
            : version != null) {
            throw new NoteConflictException();
        }
        entryFacade.deleteMealEntries(userId, date, mealId);
        existing.ifPresent(noteRepository::delete);
    }

    @Transactional
    void deleteItem(String userEmail, LocalDate date, Long entryId) {
        Long userId = userService.findUserIdByEmail(userEmail);
        lockCurrentPlanIfPresent(userId);
        FoodEntryFacade.EntryData entry = entryFacade.findEntryByIdAndUserId(entryId, userId);
        if (entry == null || !entry.date().equals(date)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        entryFacade.deleteMention(entryId, userId);
    }

    @Transactional
    void saveRespuesta(String userEmail, LocalDate date, Long mealId, RespuestaRequest req) {
        Long userId = userService.findUserIdByEmail(userEmail);
        lockCurrentPlanIfPresent(userId);
        if (!planService.mealBelongsToUser(mealId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        Long planId = planService.getPlanIdForDate(userId, date);
        if (!planService.getMealIds(planId).contains(mealId)) {
            throw new uy.miga.plans.PlanVersionConflictException();
        }
        if (planService.getPlanFoodGroups(planId).stream().noneMatch(g -> g.id().equals(req.foodGroupId()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Los grupos no pertenecen a tu plan.");
        }
        if (!req.consumed()) {
            entryFacade.deleteResponseEntries(userId, date, mealId, req.foodGroupId());
            return;
        }

        String food = planService.getPlanFoodGroups(planId).stream()
            .filter(g -> g.id().equals(req.foodGroupId()))
            .findFirst().map(uy.miga.plans.PlanFoodGroupDto::name).orElse("alimento");

        entryFacade.createResponseEntry(userId, userEmail, mealId, date, food, req.foodGroupId());
    }

    private Long lockCurrentPlanIfPresent(Long userId) {
        try {
            return planService.lockCurrentPlan(userId);
        } catch (uy.miga.plans.PlanNotFoundException ignored) {
            // Un registro histórico puede existir sin plan vigente.
            return null;
        }
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
