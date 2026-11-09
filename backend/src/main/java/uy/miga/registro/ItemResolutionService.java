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
class ItemResolutionService {
    private final InterpreterService interpreter;
    private final FoodEntryFacade entryFacade;
    private final PlanService planService;
    private final ReglaService ruleService;
    private final UserService userService;
    private final RegistroSupport support;

    ItemResolutionService(InterpreterService interpreter, FoodEntryFacade entryFacade, PlanService planService,
            ReglaService ruleService, UserService userService, RegistroSupport support) {
        this.interpreter = interpreter;
        this.entryFacade = entryFacade;
        this.planService = planService;
        this.ruleService = ruleService;
        this.userService = userService;
        this.support = support;
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
        if (req.remembers() && currentPlan != null
            && !ruleService.hasUserRuleNamed(userId, currentPlan, entry.food())) {
            RuleInput input = resolveRuleInput(entry, selected, type, groups, planId, currentPlan);
            if (input != null) {
                ruleUid = ruleService.createUserRule(userId, currentPlan, input).uid();
                planService.bumpVersion(currentPlan);
            }
        }
        List<Long> ids = replaceUnknown(id, userId, email, date, entry, occurrence, groups, type, explanation);
        entryFacade.markResolved(ids, ruleUid);
        return new ResolveItemResultDto(List.of(id), ids.stream().map(i -> support.toEntryItemDto(entryFacade.findEntryByIdAndUserId(i, userId))).toList(),
            new ResolveItemResultDto.Undo(occurrence, ruleUid));
    }

    private ResponseStatusException missingResolveGroup() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Los grupos no pertenecen a tu plan.");
    }

    private Long mapRuleGroup(Long id, String key, Long sourcePlan, Long targetPlan) {
        var target = planService.getPlanFoodGroups(targetPlan);
        if (id == null) return key == null ? null : support.resolveGroupId(key, targetPlan);
        if (target.stream().anyMatch(g -> id.equals(g.id()))) return id;
        if (sourcePlan == null) return null;
        var uid = planService.getPlanFoodGroups(sourcePlan).stream().filter(g -> id.equals(g.id()))
            .map(uy.miga.plans.PlanFoodGroupDto::uid).findFirst().orElse(null);
        return uid == null ? null : target.stream().filter(g -> uid.equals(g.uid())).map(uy.miga.plans.PlanFoodGroupDto::id).findFirst().orElse(null);
    }

    private RuleInput resolveRuleInput(FoodEntryFacade.EntryData entry, FoodRuleDto selected, String type,
            Map<Long, BigDecimal> groups, Long planId, Long currentPlan) {
        Long groupId = null;
        List<Componente> components = new ArrayList<>();
        BigDecimal quantity = BigDecimal.valueOf(entry.quantity());
        BigDecimal amount = null;
        String unit = null;
        BigDecimal defaultPortion = BigDecimal.ONE;
        if (selected != null) {
            amount = selected.cantidadPorPorcion();
            unit = selected.unidad();
            defaultPortion = selected.porcionPorDefecto();
            if ("NORMAL".equals(type)) {
                groupId = mapRuleGroup(selected.foodGroupId(), selected.standardGroupKey(), selected.planId(), currentPlan);
                if (groupId == null) return null;
            } else if ("COMPUESTO".equals(type)) {
                for (var c : selected.componentes()) {
                    Long mapped = mapRuleGroup(c.foodGroupId(), c.standardGroupKey(), selected.planId(), currentPlan);
                    if (mapped == null) return null;
                    components.add(new Componente(mapped, null, c.porciones()));
                }
            }
        } else if (!groups.isEmpty()) {
            unit = entry.unit();
            amount = unit != null ? BigDecimal.ONE : null;
            for (var g : groups.entrySet()) {
                Long mapped = mapRuleGroup(g.getKey(), null, planId, currentPlan);
                if (mapped == null) return null;
                if (groups.size() == 1) {
                    groupId = mapped;
                    if (unit == null) defaultPortion = g.getValue();
                    else amount = quantity.divide(g.getValue(), 6, RoundingMode.HALF_UP);
                } else components.add(new Componente(mapped, null, g.getValue().divide(quantity, 6, RoundingMode.HALF_UP).doubleValue()));
            }
        }
        return new RuleInput(entry.food(), List.of(), type, groupId, amount, unit, defaultPortion, components, null);
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
        Long restored = entryFacade.createMentionEntry(userId, email, source.mealId(), date, source.food(), source.quantity(), source.unit(),
            source.mealNoteId(), source.originalText(), false, null, req.occurrenceId(), false, null, null);
        return new PatchItemResultDto(ids, List.of(support.toEntryItemDto(entryFacade.findEntryByIdAndUserId(restored, userId))));
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
            type = selected.tipo();
            explanation = interpreted.appliedRule();
            addSelectedGroups(selected, type, planId, interpreted, groups);

        } else if (req.kind() == ResolveItemRequest.Kind.GROUPS) {
            if (req.groups() == null || req.groups().isEmpty()) throw missingResolveGroup();
            var allowed = planService.getPlanFoodGroups(planId).stream().map(uy.miga.plans.PlanFoodGroupDto::id).collect(Collectors.toSet());
            for (var group : req.groups()) {
                if (!allowed.contains(group.foodGroupId()) || groups.putIfAbsent(group.foodGroupId(), group.portions()) != null) throw missingResolveGroup();
            }
            type = groups.size() == 1 ? "NORMAL" : "COMPUESTO";
            var names = planService.getPlanFoodGroups(planId).stream().collect(Collectors.toMap(
                uy.miga.plans.PlanFoodGroupDto::id, uy.miga.plans.PlanFoodGroupDto::name));
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

    private List<Long> replaceUnknown(Long id, Long userId, String email, LocalDate date,
            FoodEntryFacade.EntryData entry, UUID occurrence, Map<Long, BigDecimal> groups, String type,
            String explanation) {
        entryFacade.deleteEntries(List.of(id));
        List<Long> ids = new ArrayList<>();
        if (groups.isEmpty()) {
            ids.add(entryFacade.createMentionEntry(userId, email, entry.mealId(), date, entry.food(), entry.quantity(), entry.unit(),
                entry.mealNoteId(), entry.originalText(), false, explanation, occurrence, true, type, EntryOrigin.USER));
        } else {
            for (var group : groups.entrySet()) {
                ids.add(entryFacade.createNoteEntry(userId, email, entry.mealId(), date, entry.food(), entry.quantity(), entry.unit(),
                    group.getKey(), entry.mealNoteId(), entry.originalText(), false, group.getValue(), explanation, occurrence, type, EntryOrigin.USER));
            }
        }
        return ids;
    }

    private void addSelectedGroups(FoodRuleDto selected, String type, Long planId, InterpretedItem interpreted,
            Map<Long, BigDecimal> groups) {
        if ("COMPUESTO".equals(type)) {
            for (var component : selected.componentes()) {
                Long group = mapRuleGroup(component.foodGroupId(), component.standardGroupKey(), selected.planId(), planId);
                if (group == null) throw missingResolveGroup();
                groups.merge(group, interpreted.portions().multiply(BigDecimal.valueOf(component.porciones())).setScale(3, RoundingMode.HALF_UP), BigDecimal::add);
            }
        } else if ("NORMAL".equals(type)) {
            Long group = mapRuleGroup(selected.foodGroupId(), selected.standardGroupKey(), selected.planId(), planId);
            if (group == null) throw missingResolveGroup();
            groups.put(group, interpreted.portions());
        }
    }
}
