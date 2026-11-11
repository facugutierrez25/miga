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
import uy.miga.reglas.RuleText;
import uy.miga.users.UserService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import java.time.Clock;
import uy.miga.plans.PlanFoodGroupDto;

@Service
class NoteService {
    private final MealNoteRepository noteRepository;
    private final InterpreterService interpreter;
    private final ComparisonService comparison;
    private final FoodEntryFacade entryFacade;
    private final PlanService planService;
    private final FoodRuleService ruleService;
    private final UserService userService;
    private final Clock clock;
    private final DailyLogSupport support;
    private final DayReadService dayReadService;

    NoteService(MealNoteRepository noteRepository, InterpreterService interpreter, ComparisonService comparison,
            FoodEntryFacade entryFacade, PlanService planService, FoodRuleService ruleService, UserService userService,
            Clock clock, DailyLogSupport support, DayReadService dayReadService) {
        this.noteRepository = noteRepository;
        this.interpreter = interpreter;
        this.comparison = comparison;
        this.entryFacade = entryFacade;
        this.planService = planService;
        this.ruleService = ruleService;
        this.userService = userService;
        this.clock = clock;
        this.support = support;
        this.dayReadService = dayReadService;
    }

    @Transactional(readOnly = true)
    public boolean planHasNotes(Long planId) { return noteRepository.existsByPlanId(planId); }

    // Se llama después de editar la configuración del plan, con las referencias de hoy ya en planId.
    @Transactional
    public void reinterpretTodayNotes(String email, Long planId) {
        Long userId = userService.findUserIdByEmail(email);
        support.lockCurrentPlanIfPresent(userId);
        LocalDate today = LocalDate.now(clock);
        for (MealNote note : noteRepository.findByUserIdAndDate(userId, today)) {
            if (!planId.equals(note.getPlanId()) || note.getText().isBlank()) continue;
            note.touch();
            saveNote(email, today, note.getMealId(), note.getText(), null, false);
        }
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
        if (text == null || text.isBlank() || text.length() > 2_000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ingresá una nota de hasta 2000 caracteres.");
        }
        Long userId = userService.findUserIdByEmail(userEmail);
        support.lockCurrentPlanIfPresent(userId);

        if (!planService.mealBelongsToUser(mealId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        Optional<MealNote> existing = noteRepository.findByUserIdAndDateAndMealId(userId, date, mealId);
        MealNote note = findNote(existing, userId, date, mealId, version, checkVersion);

        Long planId = selectNotePlan(note, userId, date, mealId);

        if (checkVersion && existing.isPresent() && text.strip().equals(note.getText())) {
            DayLogDto.MealDayDto meal = dayReadService.getMealLog(userEmail, date, mealId, planId);
            return new NoteInterpretationDto(note.getId(), note.getVersion(), note.getText(), date, mealId,
                List.of(), meal.items(), meal.comparison(), meal.status());
        }
        List<FoodRuleDto> rules = ruleService.findApplicable(planId, userId);

        note.setText(text.strip());
        MealNote saved = noteRepository.saveAndFlush(note);

        entryFacade.deleteNoteEntries(saved.getId());

        List<InterpretedItem> items = interpreter.interpret(text, rules);
        Map<Long, String> groupNames = planService.getPlanFoodGroups(planId).stream()
            .collect(Collectors.toMap(PlanFoodGroupDto::id, PlanFoodGroupDto::name));

        createNoteEntries(userId, userEmail, mealId, date, saved, items, rules, planId, groupNames);

        return noteResult(userEmail, date, mealId, saved, items);
    }

    private List<InterpretedItem> expandCompound(List<InterpretedItem> items,
                                                  List<FoodRuleDto> rules,
                                                  Long planId) {
        List<InterpretedItem> result = new ArrayList<>();
        for (InterpretedItem item : items) {
            if ("COMPUESTO".equals(getType(item, rules)) && item.components() != null) {
                // Expandir cada componente al grupo del plan usando standardGroupKey → clave
                for (var comp : item.components()) {
                    Long groupId = comp.foodGroupId() != null ? comp.foodGroupId()
                        : support.resolveGroupId(comp.standardGroupKey(), planId);
                    if (groupId == null) continue;
                    result.add(new InterpretedItem(
                        item.originalText(), item.foodName(),
                        item.quantity(), item.unit(),
                        groupId, comp.standardGroupKey(),
                        BigDecimal.valueOf(comp.portions()).multiply(item.portions()).setScale(3, RoundingMode.HALF_UP),
                        item.appliedRule(), item.uncertain(), item.ruleId(), null, null
                    ));
                }
            } else if (item.recognized() && item.foodGroupId() == null && item.standardGroupKey() != null) {
                // Resolver foodGroupId con la clave del plan para reglas globales
                Long groupId = support.resolveGroupId(item.standardGroupKey(), planId);
                result.add(new InterpretedItem(
                    item.originalText(), item.foodName(),
                    item.quantity(), item.unit(),
                    groupId, item.standardGroupKey(),
                    item.portions(), item.appliedRule(), item.uncertain(), item.ruleId(), null, item.type()
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
        if (!"COMPUESTO".equals(rule.type())) {
            return rule.scope().equals("GLOBAL") ? item.appliedRule() : RuleText.describe(rule, groupNames);
        }
        return (rule.amountPerPortion() != null
            ? rule.amountPerPortion().stripTrailingZeros().toPlainString().replace('.', ',') + " " + rule.unit() + " de "
            : "1 ") + rule.food() + " = " + rule.components().stream()
            .map(c -> {
                Long groupId = c.foodGroupId() != null ? c.foodGroupId() : support.resolveGroupId(c.standardGroupKey(), planId);
                String name = groupId == null ? c.standardGroupKey() : groupNames.getOrDefault(groupId, c.standardGroupKey());
                return BigDecimal.valueOf(c.portions()).stripTrailingZeros().toPlainString().replace('.', ',') + " " + name;
            })
            .collect(Collectors.joining(" + "));
    }

    // De dónde salió la regla aplicada: catálogo base, plan o corrección guardada por la persona.
    static String ruleSource(InterpretedItem item, List<FoodRuleDto> rules) {
        if (!item.recognized() || item.ruleId() == null) return null;
        return rules.stream().filter(r -> item.ruleId().equals(r.id())).findFirst()
            .map(r -> sourceOf(r.scope())).orElse(null);
    }

    static String sourceOf(String scope) {
        if (scope == null) return null;
        return switch (scope) {
            case "GLOBAL" -> "CATALOGO";
            case "PLAN" -> "PLAN";
            case EntryOrigin.USER -> EntryOrigin.USER;
            default -> null;
        };
    }

    private String getType(InterpretedItem item, List<FoodRuleDto> rules) {
        if (item.ruleId() == null) return "NORMAL";
        return rules.stream().filter(r -> r.id().equals(item.ruleId()))
            .findFirst().map(FoodRuleDto::type).orElse("NORMAL");
    }

    // Borra la nota de una comida y todo lo registrado en ella ese día. Exige la versión vigente,
    // igual que al guardar, para no borrar cambios hechos en otro dispositivo.
    @Transactional
    Long deleteNote(String userEmail, LocalDate date, Long mealId, Long version) {
        Long userId = userService.findUserIdByEmail(userEmail);
        support.lockCurrentPlanIfPresent(userId);
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
        if (existing.isEmpty()) return null;
        MealNote note = existing.get();
        note.setText("");
        // Actualizar la fecha fuerza el versionado incluso si la nota ya estaba vacía.
        note.touch();
        return noteRepository.saveAndFlush(note).getVersion();
    }

    @Transactional(readOnly = true)
    List<String> getSuggestions(String userEmail, Long mealId) {
        Long userId = userService.findUserIdByEmail(userEmail);
        return noteRepository.findTopTextsByUserIdAndMealId(userId, mealId);
    }

    private InterpretedItemDto toItemDto(InterpretedItem item) {
        return new InterpretedItemDto(
            item.originalText(), item.foodName(),
            item.quantity(), item.unit(),
            item.foodGroupId(), item.standardGroupKey(), item.portions(),
            item.appliedRule(), item.uncertain(), item.recognized(), item.type()
        );
    }

    private NoteInterpretationDto noteResult(String email, LocalDate date, Long mealId, MealNote saved,
            List<InterpretedItem> items) {
        var meal = dayReadService.getMealLog(email, date, mealId, saved.getPlanId());
        return new NoteInterpretationDto(saved.getId(), saved.getVersion(), saved.getText(), date, mealId,
            items.stream().map(this::toItemDto).toList(), meal.items(), meal.comparison(), meal.status());
    }

    private void createNoteEntries(Long userId, String userEmail, Long mealId, LocalDate date, MealNote saved,
            List<InterpretedItem> items, List<FoodRuleDto> rules, Long planId, Map<Long, String> groupNames) {
        for (InterpretedItem mention : items) {
            UUID occurrenceId = UUID.randomUUID();
            String ruleText = describeRule(mention, rules, planId, groupNames);
            String ruleType = mention.recognized() ? mention.type() : null;
            if (rules.stream().anyMatch(r -> Objects.equals(r.id(), mention.ruleId())
                    && "GLOBAL".equals(r.scope()) && r.maybeFlexible())) ruleType = "PREGUNTAR";
            String ruleSource = ruleSource(mention, rules);
            if (!mention.recognized() || Set.of("LIBRE", "FLEXIBLE", "NO_CUENTA").contains(mention.type())) {
                entryFacade.createMentionEntry(userId, userEmail, mealId, date, mention.foodName(),
                    mention.quantity().doubleValue(), mention.unit(), saved.getId(), mention.originalText(),
                    mention.recognized() && mention.uncertain(), ruleText, occurrenceId, mention.recognized(),
                    ruleType, ruleSource);
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
                    occurrenceId,
                    ruleType,
                    ruleSource
                );
            }
        }
    }

    private MealNote findNote(Optional<MealNote> existing, Long userId, LocalDate date, Long mealId, Long version,
            boolean checkVersion) {
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
        return note;
    }

    private Long selectNotePlan(MealNote note, Long userId, LocalDate date, Long mealId) {
        // Una nota ya guardada se reinterpreta con su plan si la comida es de ese plan; si no, con el
        // plan vigente de la fecha.
        Long planId = note.getPlanId() != null && planService.getMealIds(note.getPlanId()).contains(mealId)
            ? note.getPlanId()
            : planService.getPlanIdForDate(userId, date);

        if (!planService.getMealIds(planId).contains(mealId)) {
            throw new PlanChangedException();
        }
        if (note.getPlanId() == null) {
            note.setPlanId(planId);
        }

        return planId;
    }
}
