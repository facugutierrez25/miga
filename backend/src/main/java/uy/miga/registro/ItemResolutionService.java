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
import uy.miga.reglas.RuleInput;
import uy.miga.reglas.RuleText;
import uy.miga.users.UserService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import uy.miga.plans.PlanFoodGroupDto;

@Service
class ItemResolutionService {
    private final RegistrationRuleInputMapper ruleInputMapper;
    private final InterpreterService interpreter;
    private final FoodEntryFacade entryFacade;
    private final PlanService planService;
    private final FoodRuleService ruleService;
    private final UserService userService;
    private final DailyLogSupport support;
    private final DayReadService dayReadService;

    ItemResolutionService(InterpreterService interpreter, FoodEntryFacade entryFacade, PlanService planService,
            FoodRuleService ruleService, UserService userService, DailyLogSupport support, DayReadService dayReadService, RegistrationRuleInputMapper ruleInputMapper) {
        this.ruleInputMapper = ruleInputMapper;
        this.interpreter = interpreter;
        this.entryFacade = entryFacade;
        this.planService = planService;
        this.ruleService = ruleService;
        this.userService = userService;
        this.support = support;
        this.dayReadService = dayReadService;
    }

    @Transactional
    ResolveItemResultDto resolveItem(String email, LocalDate date, Long id, ResolveItemRequest req) {
        Long userId = userService.findUserIdByEmail(email);
        Long currentPlan = support.lockCurrentPlanIfPresent(userId);
        var entry = entryFacade.findEntryByIdAndUserId(id, userId);
        if (entry == null || !date.equals(entry.date())) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (!EntryOrigin.UNKNOWN.equals(entry.origin())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Este ítem ya está reconocido.");
        }
        Long planId = support.entryPlanId(userId, entry);
        UUID occurrence = entry.occurrenceId() != null ? entry.occurrenceId() : UUID.randomUUID();
        Resolution resolution = selectResolution(req, entry, userId, planId, currentPlan);
        var groups = resolution.groups();
        var selected = resolution.selected();
        String type = resolution.type();
        String explanation = resolution.explanation();
        UUID ruleUid = null;
        if (req.remembers() && currentPlan != null) {
            RuleInput input = ruleInputMapper.resolveRuleInput(entry, selected, type, groups, planId, currentPlan);
            if (input != null) {
                boolean existed = ruleService.hasUserRuleNamed(userId, currentPlan, entry.food());
                UUID savedUid = ruleService.upsertUserRule(userId, currentPlan, input).uid();
                if (!existed) ruleUid = savedUid;
                planService.bumpVersion(currentPlan);
            }
        }
        List<Long> ids = replaceEntry(id, userId, email, date, entry, occurrence, groups, type, explanation, false);
        if (selected != null) entryFacade.setCountsFlexible(ids, selected.countsFlexible());
        entryFacade.markResolved(ids, ruleUid);
        var items = ids.stream().map(itemId -> support.toEntryItemDto(entryFacade.findEntryByIdAndUserId(itemId, userId))).toList();
        return new ResolveItemResultDto(List.of(id), items, new ResolveItemResultDto.Undo(occurrence, ruleUid),
            dayReadService.getMealLog(email, date, entry.mealId(), planId).status());
    }

    @Transactional
    PatchItemResultDto answerFlexible(String email, LocalDate date, Long id, boolean answer) {
        Long userId = userService.findUserIdByEmail(email);
        support.lockCurrentPlanIfPresent(userId);
        var entry = entryFacade.findEntryByIdAndUserId(id, userId);
        if (entry == null || !date.equals(entry.date())) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (!"PREGUNTAR".equals(entry.ruleType()) || !"CATALOGO".equals(entry.ruleSource())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Esta pregunta ya fue respondida.");
        }
        Long planId = support.entryPlanId(userId, entry);
        var selected = interpreter.findRule(InterpreterService.normalize(entry.food()), ruleService.findApplicable(planId, userId));
        if (selected == null || !("USUARIO".equals(selected.scope())
                || ("GLOBAL".equals(selected.scope()) && selected.maybeFlexible()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La clasificación del alimento cambió. Recargá el día.");
        }
        // Si ya hay una regla propia (respuesta dada en otra nota), manda esa regla.
        boolean flexible = "USUARIO".equals(selected.scope()) ? ("FLEXIBLE".equals(selected.type()) || selected.countsFlexible()) : answer;
        String type = selected.type();
        if (!"USUARIO".equals(selected.scope())) {
            RuleInput input = ruleInputMapper.resolveRuleInput(entry, selected, type, Map.of(), planId, planId);
            if (input == null) throw missingResolveGroup();
            ruleService.upsertUserRule(userId, planId, new RuleInput(selected.food(), selected.synonyms(), type,
                input.foodGroupId(), input.amountPerPortion(), input.unit(), input.defaultPortions(), input.components(), selected.uid(), flexible));
            planService.bumpVersion(planId);
        }
        var mentions = entryFacade.findByMealNoteId(entry.mealNoteId()).stream()
            .filter(e -> e.food().equals(entry.food()) && "PREGUNTAR".equals(e.ruleType()) && "CATALOGO".equals(e.ruleSource())).toList();
        var replaced = mentions.stream().map(FoodEntryFacade.EntryData::id).toList();
        List<Long> ids = new ArrayList<>();
        Map<Object, List<FoodEntryFacade.EntryData>> occurrences = new LinkedHashMap<>();
        mentions.forEach(e -> occurrences.computeIfAbsent(e.occurrenceId() != null ? e.occurrenceId() : e.id(),
            key -> new ArrayList<>()).add(e));
        for (var rows : occurrences.values()) {
            var mention = rows.getFirst();
            entryFacade.deleteEntries(rows.stream().skip(1).map(FoodEntryFacade.EntryData::id).toList());
            Map<Long, BigDecimal> groups = new LinkedHashMap<>();
            addSelectedGroups(selected, type, planId,
                interpreter.computePortions(mention.originalText(), mention.quantity(), mention.unit(), selected), groups);
            var created = replaceEntry(mention.id(), userId, email, date, mention, mention.occurrenceId(), groups,
                type, mention.appliedRule(),
                Boolean.TRUE.equals(mention.uncertain()));
            entryFacade.setCountsFlexible(created, flexible);
            ids.addAll(created);
        }
        return new PatchItemResultDto(replaced, ids.stream()
            .map(itemId -> support.toEntryItemDto(entryFacade.findEntryByIdAndUserId(itemId, userId))).toList(),
            dayReadService.getMealLog(email, date, entry.mealId(), planId).status());
    }

    private ResponseStatusException missingResolveGroup() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Los grupos no pertenecen a tu plan.");
    }

    @Transactional
    PatchItemResultDto undoResolve(String email, LocalDate date, UndoResolveRequest req) {
        Long userId = userService.findUserIdByEmail(email);
        Long currentPlan = support.lockCurrentPlanIfPresent(userId);
        var entries = entryFacade.findByUserIdAndDate(userId, date).stream()
            .filter(e -> req.occurrenceId().equals(e.occurrenceId())).toList();
        if (entries.isEmpty() || entries.stream().anyMatch(e -> !EntryOrigin.USER.equals(e.ruleSource()) || !e.resolved())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        var source = entries.getFirst();
        Long planId = support.entryPlanId(userId, source);
        UUID ruleUid = source.resolvedRuleUid();
        if (entries.stream().anyMatch(e -> !Objects.equals(ruleUid, e.resolvedRuleUid()))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        if (ruleUid != null && currentPlan != null && ruleService.getUserRules(userId, currentPlan).stream()
            .anyMatch(r -> ruleUid.equals(r.uid()))) {
            ruleService.deleteUserRule(userId, currentPlan, ruleUid);
            planService.bumpVersion(currentPlan);
        }
        var ids = entries.stream().map(FoodEntryFacade.EntryData::id).toList();
        entryFacade.deleteEntries(ids);
        Long restored = entryFacade.createMentionEntry(userId, email, source.mealId(), date, source.food(),
            source.quantity(), source.unit(), source.mealNoteId(), source.originalText(), false, null,
            req.occurrenceId(), false, null, null);
        return new PatchItemResultDto(ids, List.of(support.toEntryItemDto(entryFacade.findEntryByIdAndUserId(restored, userId))),
            dayReadService.getMealLog(email, date, source.mealId(), planId).status());
    }

    private Resolution selectResolution(ResolveItemRequest req, FoodEntryFacade.EntryData entry, Long userId,
            Long planId, Long currentPlan) {
        Map<Long, BigDecimal> groups = new LinkedHashMap<>();
        FoodRuleDto selected = null;
        String type;
        String explanation;
        if (req.kind() == ResolveItemRequest.Kind.SAME_AS) {
            if (req.ruleUid() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Elegí un alimento.");
            selected = ruleService.getRuleForResolve(req.ruleUid(), userId, planId, currentPlan);
            var interpreted = interpreter.computePortions(entry.originalText(), entry.quantity(), entry.unit(), selected);
            type = selected.type();
            explanation = interpreted.appliedRule();
            addSelectedGroups(selected, type, planId, interpreted, groups);

        } else if (req.kind() == ResolveItemRequest.Kind.GROUPS) {
            if (req.groups() == null || req.groups().isEmpty()) throw missingResolveGroup();
            var allowed = planService.getPlanFoodGroups(planId).stream().map(PlanFoodGroupDto::id).collect(Collectors.toSet());
            for (var group : req.groups()) {
                boolean repeated = groups.putIfAbsent(group.foodGroupId(), group.portions()) != null;
                if (!allowed.contains(group.foodGroupId()) || repeated) throw missingResolveGroup();
            }
            type = groups.size() == 1 ? "NORMAL" : "COMPUESTO";
            var names = planService.getPlanFoodGroups(planId).stream().collect(Collectors.toMap(
                PlanFoodGroupDto::id, PlanFoodGroupDto::name));
            explanation = "Corrección del usuario: " + groups.entrySet().stream()
                .map(g -> g.getValue() + " " + RuleText.portionUnit(g.getValue()) + " de " + names.get(g.getKey()))
                .collect(Collectors.joining(" + "));
        } else {
            type = req.kind() == ResolveItemRequest.Kind.FLEXIBLE ? "FLEXIBLE" : "NO_CUENTA";
            explanation = entry.food() + ("FLEXIBLE".equals(type) ? " = flexible (sin porción fija)" : " = no cuenta");
        }
        return new Resolution(groups, selected, type, explanation);
    }
    private record Resolution(Map<Long, BigDecimal> groups, FoodRuleDto selected, String type, String explanation) {}

    private List<Long> replaceEntry(Long id, Long userId, String email, LocalDate date,
            FoodEntryFacade.EntryData entry, UUID occurrence, Map<Long, BigDecimal> groups, String type,
            String explanation, boolean uncertain) {
        entryFacade.deleteEntries(List.of(id));
        List<Long> ids = new ArrayList<>();
        if (groups.isEmpty()) {
            ids.add(entryFacade.createMentionEntry(userId, email, entry.mealId(), date, entry.food(), entry.quantity(), entry.unit(),
                entry.mealNoteId(), entry.originalText(), uncertain, explanation, occurrence, true, type, EntryOrigin.USER));
        } else {
            for (var group : groups.entrySet()) {
                ids.add(entryFacade.createNoteEntry(userId, email, entry.mealId(), date, entry.food(), entry.quantity(),
                    entry.unit(), group.getKey(), entry.mealNoteId(), entry.originalText(), uncertain, group.getValue(),
                    explanation, occurrence, type, EntryOrigin.USER));
            }
        }
        return ids;
    }

    private void addSelectedGroups(FoodRuleDto selected, String type, Long planId, InterpretedItem interpreted,
            Map<Long, BigDecimal> groups) {
        if ("COMPUESTO".equals(type)) {
            for (var component : selected.components()) {
                Long group = ruleInputMapper.mapRuleGroup(component.foodGroupId(), component.standardGroupKey(), selected.planId(), planId);
                if (group == null) throw missingResolveGroup();
                BigDecimal portions = interpreted.portions().multiply(BigDecimal.valueOf(component.portions()))
                    .setScale(3, RoundingMode.HALF_UP);
                groups.merge(group, portions, BigDecimal::add);
            }
        } else if ("NORMAL".equals(type)) {
            Long group = ruleInputMapper.mapRuleGroup(selected.foodGroupId(), selected.standardGroupKey(), selected.planId(), planId);
            if (group == null) throw missingResolveGroup();
            groups.put(group, interpreted.portions());
        }
    }
}
