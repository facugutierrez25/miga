package uy.miga.registro;

import uy.miga.intake.EntryOrigin;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uy.miga.intake.FoodEntryFacade;
import uy.miga.plans.PlanService;
import uy.miga.reglas.FoodRuleService;
import uy.miga.reglas.RuleComponent;
import uy.miga.reglas.RuleInput;
import uy.miga.reglas.RuleText;
import uy.miga.users.UserService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import uy.miga.plans.PlanFoodGroupDto;
import uy.miga.plans.PlanVersionConflictException;

@Service
class ItemCorrectionService {
    private final MealNoteRepository noteRepository;
    private final FoodEntryFacade entryFacade;
    private final PlanService planService;
    private final FoodRuleService ruleService;
    private final UserService userService;
    private final DailyLogSupport support;
    private final DayReadService dayReadService;

    ItemCorrectionService(MealNoteRepository noteRepository, FoodEntryFacade entryFacade, PlanService planService,
            FoodRuleService ruleService, UserService userService, DailyLogSupport support, DayReadService dayReadService) {
        this.noteRepository = noteRepository;
        this.entryFacade = entryFacade;
        this.planService = planService;
        this.ruleService = ruleService;
        this.userService = userService;
        this.support = support;
        this.dayReadService = dayReadService;
    }

    @Transactional
    DayLogDto.MealDayDto removeItem(String userEmail, LocalDate date, Long entryId, Long version) {
        Long userId = userService.findUserIdByEmail(userEmail);
        support.lockCurrentPlanIfPresent(userId);
        var entry = entryFacade.findEntryByIdAndUserId(entryId, userId);
        if (entry == null || !entry.date().equals(date)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (entry.mealNoteId() == null || EntryOrigin.RESPONSE.equals(entry.origin())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Solo podés quitar alimentos de una nota.");
        }
        MealNote note = noteRepository.findByUserIdAndDateAndMealId(userId, date, entry.mealId())
            .filter(n -> n.getId().equals(entry.mealNoteId())).orElseThrow(NoteConflictException::new);
        if (version == null || !version.equals(note.getVersion())) throw new NoteConflictException();
        Removal removal = prepareRemoval(note, entryId);
        var mentions = removal.mentions();
        int index = removal.index();
        String text = removal.text();
        // Solo se borran los ítems de esa mención: las respuestas y las cargas manuales de la comida quedan.
        entryFacade.deleteEntries(mentions.get(index).stream().map(FoodEntryFacade.EntryData::id).toList());
        note.setText(text);
        note.touch();
        noteRepository.saveAndFlush(note);
        return dayReadService.getMealLog(userEmail, date, entry.mealId(), support.entryPlanId(userId, entry));
    }

    @Transactional
    PatchItemResultDto patchItem(String userEmail, LocalDate date, Long entryId, PatchItemRequest req) {
        Long userId = userService.findUserIdByEmail(userEmail);
        Long currentPlanId = support.lockCurrentPlanIfPresent(userId);
        FoodEntryFacade.EntryData entry = entryFacade.findEntryByIdAndUserId(entryId, userId);
        if (entry == null || !entry.date().equals(date)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (EntryOrigin.UNKNOWN.equals(entry.origin()) || (EntryOrigin.MENTION.equals(entry.origin())
                && !Set.of("LIBRE", "NO_CUENTA", "FLEXIBLE").contains(entry.ruleType() == null ? "" : entry.ruleType()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Esta mención no admite correcciones.");
        }
        if (req.groups() != null && (req.foodGroupId() != null || req.portions() != null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Indicá un grupo o varios grupos, no ambos.");
        }

        if (req.makesFlexible() && (req.groups() != null || req.foodGroupId() != null || req.portions() != null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Una comida flexible no lleva grupos ni porciones.");
        }
        if ("FLEXIBLE".equals(entry.ruleType()) && !req.makesFlexible()
                && req.groups() == null) {
            if (req.foodGroupId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Elegí un grupo para dejar de contarla como flexible.");
            }
            if (req.portions() == null || req.portions().signum() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Indicá porciones mayores a cero para volver a un grupo.");
            }
        }
        Long planId = support.entryPlanId(userId, entry);
        if (!planService.getMealIds(planId).contains(entry.mealId())) {
            throw new PlanVersionConflictException();
        }
        if (req.savesRule() && !planId.equals(currentPlanId)) {
            throw new PlanVersionConflictException();
        }
        validateCorrectionGroups(planId, req);

        var occurrence = req.flexible() != null ? entryFacade.occurrence(entryId) : List.<FoodEntryFacade.EntryData>of();
        if (occurrence.stream().anyMatch(e -> "PREGUNTAR".equals(e.ruleType()) && "CATALOGO".equals(e.ruleSource()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Respondé primero si cuenta como comida flexible.");
        }
        if (req.flexible() != null && occurrence.stream().anyMatch(e -> e.foodGroupId() != null)) {
            if (req.quantity() != null || req.unit() != null || req.foodGroupId() != null
                    || req.portions() != null || req.groups() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Marcá o quitá la comida flexible sin cambiar la cantidad ni los grupos.");
            }
            var ids = occurrence.stream().map(FoodEntryFacade.EntryData::id).toList();
            entryFacade.setCountsFlexible(ids, req.makesFlexible());
            if (req.savesRule()) {
                var groups = new LinkedHashMap<Long, BigDecimal>();
                occurrence.stream().filter(e -> e.foodGroupId() != null && e.portions() != null)
                    .forEach(e -> groups.merge(e.foodGroupId(), e.portions(), BigDecimal::add));
                saveOccurrenceRule(userId, planId, entry, groups, req.makesFlexible());
                planService.bumpVersion(planId);
            }
            return new PatchItemResultDto(ids, ids.stream()
                .map(id -> support.toEntryItemDto(entryFacade.findEntryByIdAndUserId(id, userId))).toList(),
                dayReadService.getMealLog(userEmail, date, entry.mealId(), planId).status());
        }
        List<Long> replacedIds = List.of(entryId);
        if (req.makesFlexible()) {
            replacedIds = entryFacade.makeFlexible(entryId);
        } else if ("FLEXIBLE".equals(entry.ruleType())) {
            replacedIds = entryFacade.collapseOccurrence(entryId);
        }
        List<Long> resultIds = applyCorrection(userId, planId, entryId, entry, req);

        if (req.savesRule()) {
            planService.bumpVersion(planId);
        }
        List<DayLogDto.EntryItemDto> items = resultIds.stream()
            .map(id -> support.toEntryItemDto(entryFacade.findEntryByIdAndUserId(id, userId)))
            .toList();
        return new PatchItemResultDto(replacedIds, items, dayReadService.getMealLog(userEmail, date, entry.mealId(), planId).status());
    }

    // Al cambiar solo la cantidad, las porciones se ajustan en la misma proporción.
    private BigDecimal scaledPortions(FoodEntryFacade.EntryData entry, BigDecimal quantity) {
        if (entry.portions() == null || entry.quantity() == null || entry.quantity() <= 0) return entry.portions();
        return entry.portions().multiply(quantity)
            .divide(BigDecimal.valueOf(entry.quantity()), 3, RoundingMode.HALF_UP);
    }

    @Transactional
    void saveAnswer(String userEmail, LocalDate date, Long mealId, AnswerRequest req) {
        Long userId = userService.findUserIdByEmail(userEmail);
        support.lockCurrentPlanIfPresent(userId);
        if (!planService.mealBelongsToUser(mealId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        Long planId = planService.getPlanIdForDate(userId, date);
        if (!planService.getMealIds(planId).contains(mealId)) {
            throw new PlanChangedException();
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
            .findFirst().map(PlanFoodGroupDto::name).orElse("alimento");

        entryFacade.createResponseEntry(userId, userEmail, mealId, date, food, req.foodGroupId());
    }

    private Removal prepareRemoval(MealNote note, Long entryId) {
        var entries = entryFacade.findByMealNoteId(note.getId());
        Map<Object, List<FoodEntryFacade.EntryData>> occurrences = new LinkedHashMap<>();
        for (var item : entries) {
            Object key = item.occurrenceId() != null ? item.occurrenceId() : item.id();
            occurrences.computeIfAbsent(key, k -> new ArrayList<>()).add(item);
        }
        var mentions = new ArrayList<>(occurrences.values());
        int index = -1;
        for (int i = 0; i < mentions.size(); i++) {
            if (mentions.get(i).stream().anyMatch(e -> e.id().equals(entryId))) index = i;
        }
        String text;
        try {
            text = NoteTextEditor.removeMention(note.getText(), mentions.stream()
                .map(m -> m.get(0).originalText()).toList(), index);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                "No se pudo ubicar el alimento en la nota con seguridad. Recargá la nota e intentá de nuevo.");
        }
        return new Removal(mentions, index, text);
    }
    private record Removal(List<List<FoodEntryFacade.EntryData>> mentions, int index, String text) {}

    private List<Long> applyCorrection(Long userId, Long planId, Long entryId, FoodEntryFacade.EntryData entry,
            PatchItemRequest req) {
        BigDecimal quantity = req.quantity() != null ? req.quantity() : BigDecimal.valueOf(entry.quantity() != null ? entry.quantity() : 1);
        List<Long> resultIds;
        if (req.makesFlexible()) {
            resultIds = List.of(entryId);
            if (req.savesRule()) {
                ruleService.upsertUserRule(userId, planId, new RuleInput(entry.food(), List.of(), "FLEXIBLE",
                    null, null, null, null, List.of(), null));
            }
        } else if (req.groups() != null) {
            Map<Long, BigDecimal> portionsByGroup = new LinkedHashMap<>();
            req.groups().forEach(g -> portionsByGroup.put(g.foodGroupId(), g.portions()));
            resultIds = entryFacade.splitEntry(entryId, portionsByGroup);
            if (req.savesRule()) {
                saveOccurrenceRule(userId, planId, entry, portionsByGroup, entry.countsFlexible() && !"FLEXIBLE".equals(entry.ruleType()));
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
                String unit = req.unit() != null ? req.unit() : entry.unit();
                if (RuleText.portionUnit(BigDecimal.ONE).equals(unit) || RuleText.portionUnit(BigDecimal.ZERO).equals(unit)) {
                    unit = null;
                }
                ruleService.upsertUserRule(userId, planId, new RuleInput(entry.food(), List.of(), "NORMAL",
                    groupId, unit != null ? quantity.divide(portions, 3, RoundingMode.HALF_UP) : null,
                    unit, unit != null ? BigDecimal.ONE
                        : portions.divide(InterpreterService.parsedFoodCount(entry.originalText()), 3, RoundingMode.HALF_UP),
                    List.of(), null, entry.countsFlexible() && !"FLEXIBLE".equals(entry.ruleType())));
            }
        }

        return resultIds;
    }

    private void saveOccurrenceRule(Long userId, Long planId, FoodEntryFacade.EntryData entry,
            Map<Long, BigDecimal> groups, boolean flexible) {
        String unit = entry.unit();
        if (RuleText.portionUnit(BigDecimal.ONE).equals(unit) || RuleText.portionUnit(BigDecimal.ZERO).equals(unit)) unit = null;
        BigDecimal quantity = unit != null ? BigDecimal.valueOf(entry.quantity()) : InterpreterService.parsedFoodCount(entry.originalText());
        if (groups.isEmpty() || groups.values().stream().anyMatch(p -> p.signum() <= 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Para guardar como regla, indicá porciones mayores a cero");
        }
        var first = groups.entrySet().iterator().next();
        boolean compound = groups.size() > 1;
        var components = compound ? groups.entrySet().stream().map(g -> new RuleComponent(g.getKey(), null,
            g.getValue().divide(quantity, 3, RoundingMode.HALF_UP).doubleValue())).toList() : List.<RuleComponent>of();
        ruleService.upsertUserRule(userId, planId, new RuleInput(entry.food(), List.of(), compound ? "COMPUESTO" : "NORMAL",
            compound ? null : first.getKey(), unit == null ? null : compound ? BigDecimal.ONE : quantity.divide(first.getValue(), 3, RoundingMode.HALF_UP),
            unit, compound || unit != null ? BigDecimal.ONE : first.getValue().divide(quantity, 3, RoundingMode.HALF_UP),
            components, null, flexible));
    }

    private void validateCorrectionGroups(Long planId, PatchItemRequest req) {
        Set<Long> planGroups = planService.getPlanFoodGroups(planId).stream()
            .map(PlanFoodGroupDto::id).collect(Collectors.toSet());
        List<Long> requestedGroups = req.groups() != null
            ? req.groups().stream().map(PatchItemRequest.GroupPortion::foodGroupId).toList()
            : (req.foodGroupId() != null ? List.of(req.foodGroupId()) : List.of());
        if (!planGroups.containsAll(requestedGroups)
            || new HashSet<>(requestedGroups).size() != requestedGroups.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Los grupos no pertenecen a tu plan.");
        }
    }
}
