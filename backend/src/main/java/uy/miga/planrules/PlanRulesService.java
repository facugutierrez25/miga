package uy.miga.planrules;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uy.miga.habitos.HabitConfigDto;
import uy.miga.habitos.HabitConfigService;
import uy.miga.intake.FoodEntryFacade;
import uy.miga.plans.GroupInput;
import uy.miga.plans.PlanFoodGroupDto;
import uy.miga.plans.PlanRef;
import uy.miga.plans.PlanService;
import uy.miga.plans.PlanVersionConflictException;
import uy.miga.registro.DailyLogService;
import uy.miga.reglas.RuleComponent;
import uy.miga.reglas.FoodRuleDto;
import uy.miga.reglas.InvalidRuleException;
import uy.miga.reglas.FoodRuleService;
import uy.miga.reglas.RuleInput;
import uy.miga.reglas.RuleText;
import uy.miga.users.UserService;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Predicate;
import java.util.stream.Collectors;

@Service
@Transactional
class PlanRulesService {
    private final PlanService plans;
    private final FoodRuleService rules;
    private final HabitConfigService habits;
    private final DailyLogService notes;
    private final FoodEntryFacade entries;
    private final UserService users;

    PlanRulesService(PlanService plans, FoodRuleService rules, HabitConfigService habits,
                     DailyLogService notes, FoodEntryFacade entries, UserService users) {
        this.plans = plans;
        this.rules = rules;
        this.habits = habits;
        this.notes = notes;
        this.entries = entries;
        this.users = users;
    }

    @Transactional(readOnly = true)
    PlanRulesDto get(String email) {
        return aggregate(users.findUserIdByEmail(email));
    }

    @Transactional(readOnly = true)
    List<PlanRulesDto.CatalogDto> catalog(String email, String query) {
        Long user = users.findUserIdByEmail(email);
        Long planId = plans.currentPlanRef(user).id();
        Map<UUID, UUID> adjustments = rules.getUserRules(user, planId).stream()
            .filter(rule -> rule.overridesRuleUid() != null)
            .collect(Collectors.toMap(FoodRuleDto::overridesRuleUid, FoodRuleDto::uid));
        List<PlanFoodGroupDto> groups = plans.getPlanFoodGroups(planId);
        return rules.searchCatalog(query, planId, user, 30).stream()
            .map(rule -> toCatalogDto(toRuleDto(rule, groups), adjustments))
            .toList();
    }

    // ── Grupos ────────────────────────────────────────────────────────────────

    PlanRulesDto group(String email, UUID uid, Requests.Group req) {
        return mutateWithCopy(email, req.planVersion(),
            current -> { if (uid != null) plans.findGroupIdByUid(current.id(), uid); },
            current -> uid != null && groupUnchanged(current.id(), uid, req),
            (user, planId) -> {
                if (uid == null) plans.createGroup(planId, req.input());
                else plans.updateGroup(planId, uid, req.input());
            });
    }

    PlanRulesDto order(String email, Requests.Order req) {
        return mutateWithCopy(email, req.planVersion(),
            current -> requireAllGroups(current.id(), req.uids()),
            current -> groupUids(current.id()).equals(req.uids()),
            (user, planId) -> plans.reorderGroups(planId, req.uids()));
    }

    PlanRulesDto deleteGroup(String email, UUID uid, Long version) {
        return mutateWithCopy(email, version,
            current -> plans.findGroupIdByUid(current.id(), uid),
            current -> false,
            (user, planId) -> {
                Long groupId = plans.findGroupIdByUid(planId, uid);
                int meals = plans.countMealPortions(planId, groupId);
                int foods = rules.countGroupReferences(planId, groupId);
                if (meals + foods > 0) throw new GroupInUseException(groupName(planId, uid), meals, foods);
                entries.detachGroup(groupId);
                plans.deleteGroup(planId, uid);
            });
    }

    // ── Alimentos (se editan en la versión vigente, ver ADR-0005) ────────────

    PlanRulesDto rule(String email, UUID uid, Requests.Rule req) {
        Long user = users.findUserIdByEmail(email);
        return mutateInPlace(email, req.planVersion(),
            current -> {
                toRuleInput(current.id(), req);
                if (uid != null) requireUserRule(user, current.id(), uid);
            },
            current -> uid != null && ruleUnchanged(user, uid, req),
            (owner, planId) -> {
                if (uid == null) rules.createUserRule(owner, planId, toRuleInput(planId, req));
                else rules.updateUserRule(owner, planId, uid, toRuleInput(planId, req));
            });
    }

    PlanRulesDto deleteRule(String email, UUID uid, Long version) {
        Long user = users.findUserIdByEmail(email);
        return mutateInPlace(email, version,
            current -> requireUserRule(user, current.id(), uid),
            current -> false,
            (owner, planId) -> rules.deleteUserRule(owner, planId, uid));
    }

    PlanRulesDto adjust(String email, UUID uid, Requests.Version req) {
        return mutateInPlace(email, req.planVersion(),
            current -> rules.getRuleForAdjust(uid, current.id()),
            current -> false,
            (owner, planId) -> {
                FoodRuleDto rule = withPlanGroups(rules.getRuleForAdjust(uid, planId), plans.getPlanFoodGroups(planId));
                if ("NORMAL".equals(rule.type()) && rule.foodGroupId() == null) {
                    throw new InvalidRuleException("No hay un grupo del plan para la clave de este alimento.");
                }
                rules.createUserRule(owner, planId, new RuleInput(rule.food(), rule.synonyms(), rule.type(),
                    rule.foodGroupId(), rule.amountPerPortion(), rule.unit(), rule.defaultPortions(),
                    rule.components(), uid));
            });
    }

    // ── Hábitos ───────────────────────────────────────────────────────────────

    PlanRulesDto habit(String email, UUID uid, Requests.Habit req) {
        return mutateWithCopy(email, req.planVersion(),
            current -> { if (uid != null) requireHabit(current.id(), uid); },
            current -> uid != null && habitUnchanged(current.id(), uid, req),
            (user, planId) -> {
                if (uid == null) habits.createHabit(planId, req.input());
                else habits.updateHabit(planId, uid, req.input());
            });
    }

    PlanRulesDto deleteHabit(String email, UUID uid, Long version) {
        return mutateWithCopy(email, version,
            current -> requireHabit(current.id(), uid),
            current -> false,
            (user, planId) -> habits.removeHabit(planId, uid));
    }

    // ── Mutaciones ────────────────────────────────────────────────────────────

    // Grupos y hábitos: si la versión ya tiene registros, el cambio se aplica a una copia.
    private PlanRulesDto mutateWithCopy(String email, Long version, Consumer<PlanRef> validate,
                                        Predicate<PlanRef> unchanged, BiConsumer<Long, Long> change) {
        Long user = users.findUserIdByEmail(email);
        PlanRef current = lockAndCheck(user, version);
        validate.accept(current);
        if (unchanged.test(current)) return aggregate(user);
        boolean used = planIsUsed(current.id());
        Long editable = used ? plans.forkCurrentPlan(user) : current.id();
        change.accept(user, editable);
        if (used) notes.reinterpretTodayNotes(email, editable);
        else plans.checkAndBumpVersion(editable, version);
        return aggregate(user);
    }

    private PlanRulesDto mutateInPlace(String email, Long version, Consumer<PlanRef> validate,
                                       Predicate<PlanRef> unchanged, BiConsumer<Long, Long> change) {
        Long user = users.findUserIdByEmail(email);
        PlanRef current = lockAndCheck(user, version);
        validate.accept(current);
        if (unchanged.test(current)) return aggregate(user);
        change.accept(user, current.id());
        plans.checkAndBumpVersion(current.id(), version);
        notes.reinterpretTodayNotes(email, current.id());
        return aggregate(user);
    }

    private PlanRef lockAndCheck(Long user, Long version) {
        plans.lockCurrentPlan(user);
        PlanRef current = plans.currentPlanRef(user);
        if (!Objects.equals(current.version(), version)) throw new PlanVersionConflictException();
        return current;
    }

    private boolean planIsUsed(Long planId) {
        return notes.planHasNotes(planId)
            || entries.hasEntriesForMeals(plans.getMealIds(planId))
            || habits.planHasLogs(planId);
    }

    // ── Lectura ───────────────────────────────────────────────────────────────

    private PlanRulesDto aggregate(Long userId) {
        PlanRef ref = plans.currentPlanRef(userId);
        List<PlanFoodGroupDto> groups = plans.getPlanFoodGroups(ref.id());
        List<PlanRulesDto.RuleDto> foods = rules.getPlanRules(ref.id(), userId).stream()
            .map(rule -> toRuleDto(rule, groups))
            .toList();
        return new PlanRulesDto(ref.id(), ref.version(), plans.getLoggingMode(ref.id()), groups,
            foods, habits.listHabits(ref.id()));
    }

    private PlanRulesDto.RuleDto toRuleDto(FoodRuleDto original, List<PlanFoodGroupDto> groups) {
        FoodRuleDto rule = withPlanGroups(original, groups);
        Map<Long, UUID> uids = groups.stream().collect(Collectors.toMap(PlanFoodGroupDto::id, PlanFoodGroupDto::uid));
        Map<Long, String> names = groups.stream().collect(Collectors.toMap(PlanFoodGroupDto::id, PlanFoodGroupDto::name));
        List<PlanRulesDto.ComponentDto> components = rule.components().stream()
            .map(component -> new PlanRulesDto.ComponentDto(uids.get(component.foodGroupId()), component.portions()))
            .toList();
        return new PlanRulesDto.RuleDto(rule.uid(), rule.scope(), rule.food(), rule.synonyms(), rule.type(),
            uids.get(rule.foodGroupId()), rule.amountPerPortion(), rule.unit(), rule.defaultPortions(),
            components, rule.overridesRuleUid(), RuleText.describe(rule, names));
    }

    private static PlanRulesDto.CatalogDto toCatalogDto(PlanRulesDto.RuleDto rule, Map<UUID, UUID> adjustments) {
        return new PlanRulesDto.CatalogDto(rule.uid(), rule.scope(), rule.food(), rule.synonyms(), rule.type(),
            rule.groupUid(), rule.ruleText(), adjustments.get(rule.uid()));
    }

    // Las reglas del catálogo nombran el grupo por clave: se resuelve al grupo del plan.
    private static FoodRuleDto withPlanGroups(FoodRuleDto rule, List<PlanFoodGroupDto> groups) {
        Long group = rule.foodGroupId() != null ? rule.foodGroupId() : groupIdByKey(groups, rule.standardGroupKey());
        List<RuleComponent> components = rule.components() == null ? List.of() : rule.components().stream()
            .map(component -> new RuleComponent(
                component.foodGroupId() != null ? component.foodGroupId() : groupIdByKey(groups, component.standardGroupKey()),
                component.standardGroupKey(), component.portions()))
            .toList();
        return new FoodRuleDto(rule.id(), rule.scope(), rule.planId(), rule.userId(), rule.food(),
            rule.synonyms(), rule.type(), rule.standardGroupKey(), group, components, rule.amountPerPortion(),
            rule.unit(), rule.defaultPortions(), rule.uid(), rule.overridesRuleUid());
    }

    private static Long groupIdByKey(List<PlanFoodGroupDto> groups, String key) {
        if (key == null) return null;
        return groups.stream().filter(group -> key.equals(group.standardKey()))
            .map(PlanFoodGroupDto::id).findFirst().orElse(null);
    }

    // ── Validaciones y comparaciones ──────────────────────────────────────────

    private RuleInput toRuleInput(Long planId, Requests.Rule req) {
        if (req.overridesRuleUid() != null) rules.getRuleForAdjust(req.overridesRuleUid(), planId);
        Long group = req.groupUid() == null ? null : plans.findGroupIdByUid(planId, req.groupUid());
        List<RuleComponent> components = req.components() == null ? List.of() : req.components().stream()
            .map(component -> new RuleComponent(plans.findGroupIdByUid(planId, component.groupUid()), null, component.portions()))
            .toList();
        return new RuleInput(req.food(), req.synonyms(), req.type(), group, req.amountPerPortion(),
            req.unit(), req.defaultPortions(), components, req.overridesRuleUid());
    }

    private void requireAllGroups(Long planId, List<UUID> requested) {
        Set<UUID> all = new HashSet<>(groupUids(planId));
        if (requested.size() != all.size() || !all.equals(new HashSet<>(requested))) {
            throw new IllegalArgumentException("Indicá todos los grupos del plan una sola vez.");
        }
    }

    private List<UUID> groupUids(Long planId) {
        return plans.getPlanFoodGroups(planId).stream().map(PlanFoodGroupDto::uid).toList();
    }

    private String groupName(Long planId, UUID uid) {
        return plans.getPlanFoodGroups(planId).stream()
            .filter(group -> group.uid().equals(uid)).findFirst().orElseThrow().name();
    }

    private boolean groupUnchanged(Long planId, UUID uid, Requests.Group req) {
        return plans.getPlanFoodGroups(planId).stream()
            .filter(group -> group.uid().equals(uid))
            .anyMatch(group -> requestedGroup(req, group).equals(new GroupInput(group.name(), group.abbreviation(),
                group.standardKey(), group.color(), group.askIfMissing(), group.optional())));
    }

    // Sin abreviatura ni color en el pedido, se conservan los del grupo.
    private static GroupInput requestedGroup(Requests.Group req, PlanFoodGroupDto group) {
        String abbreviation = req.abbreviation() == null || req.abbreviation().isBlank() ? group.abbreviation() : req.abbreviation();
        String color = req.color() == null ? group.color() : req.color();
        return new GroupInput(req.name().strip(), abbreviation, req.standardKey(), color,
            Boolean.TRUE.equals(req.askIfMissing()), Boolean.TRUE.equals(req.optional()));
    }

    private void requireUserRule(Long user, Long planId, UUID uid) {
        if (rules.getUserRules(user, planId).stream().noneMatch(rule -> rule.uid().equals(uid))) throw missing();
    }

    private boolean ruleUnchanged(Long user, UUID uid, Requests.Rule req) {
        return aggregate(user).foods().stream()
            .filter(rule -> rule.uid().equals(uid))
            .anyMatch(rule -> sameRule(rule, req));
    }

    private static boolean sameRule(PlanRulesDto.RuleDto rule, Requests.Rule req) {
        List<Requests.Component> components = rule.components().stream()
            .map(component -> new Requests.Component(component.groupUid(), component.portions()))
            .toList();
        return rule.food().equals(req.food().strip())
            && Objects.equals(rule.type(), req.type())
            && Objects.equals(orEmpty(rule.synonyms()), orEmpty(req.synonyms()))
            && Objects.equals(rule.groupUid(), req.groupUid())
            && Objects.equals(rule.unit(), req.unit())
            && decimalEquals(rule.amountPerPortion(), req.amountPerPortion())
            && decimalEquals(rule.defaultPortions(), req.defaultPortions() == null ? BigDecimal.ONE : req.defaultPortions())
            && Objects.equals(components, orEmpty(req.components()))
            && Objects.equals(rule.overridesRuleUid(), req.overridesRuleUid());
    }

    private void requireHabit(Long planId, UUID uid) {
        if (habits.listHabits(planId).stream().noneMatch(habit -> habit.uid().equals(uid))) throw missing();
    }

    private boolean habitUnchanged(Long planId, UUID uid, Requests.Habit req) {
        return habits.listHabits(planId).stream()
            .filter(habit -> habit.uid().equals(uid))
            .anyMatch(habit -> sameHabit(habit, req));
    }

    private static boolean sameHabit(HabitConfigDto habit, Requests.Habit req) {
        return habit.name().equals(req.name().strip())
            && habit.habitType().equals(req.habitType())
            && Objects.equals(habit.unit(), req.unit())
            && decimalEquals(habit.goal(), req.goal())
            && habit.period().equals(req.period())
            && decimalEquals(habit.step(), req.step() == null ? BigDecimal.ONE : req.step())
            && habit.countsFlexibleMeals() == Boolean.TRUE.equals(req.countsFlexibleMeals());
    }

    private static <T> List<T> orEmpty(List<T> values) {
        return values == null ? List.of() : values;
    }

    private static boolean decimalEquals(BigDecimal a, BigDecimal b) {
        return a == null ? b == null : b != null && a.compareTo(b) == 0;
    }

    private static ResponseStatusException missing() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "No se encontró el recurso en tu plan.");
    }
}
