package uy.miga.planrules;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import uy.miga.plans.*;
import uy.miga.reglas.*;
import uy.miga.habitos.*;
import uy.miga.registro.RegistroService;
import uy.miga.intake.FoodEntryFacade;
import uy.miga.users.UserService;
import java.util.*;
import java.util.function.Consumer;
import java.util.stream.Collectors;

@Service
@Transactional
class PlanRulesService {
    private final PlanService plans;
    private final ReglaService rules;
    private final HabitConfigService habits;
    private final RegistroService notes;
    private final FoodEntryFacade entries;
    private final UserService users;
    PlanRulesService(PlanService plans, ReglaService rules, HabitConfigService habits, RegistroService notes, FoodEntryFacade entries, UserService users) {
        this.plans = plans; this.rules = rules; this.habits = habits; this.notes = notes; this.entries = entries; this.users = users;
    }
    @Transactional(readOnly=true)
    PlanRulesDto get(String email) { return aggregate(users.findUserIdByEmail(email)); }
    private PlanRulesDto aggregate(Long userId) {
        PlanRef ref = plans.currentPlanRef(userId);
        var groups = plans.getPlanFoodGroups(ref.id());
        return new PlanRulesDto(ref.id(), ref.version(), plans.getModoRegistro(ref.id()), groups,
            rules.getPlanRules(ref.id(), userId).stream().map(r -> dto(r, ref.id(), groups)).toList(), habits.listHabits(ref.id()));
    }
    private FoodRuleDto resolve(FoodRuleDto r, Long planId) {
        Long group = r.foodGroupId() != null ? r.foodGroupId() : plans.findGroupIdByClave(planId, r.standardGroupKey());
        var components = r.componentes() == null ? List.<Componente>of() : r.componentes().stream()
            .map(c -> new Componente(c.foodGroupId() != null ? c.foodGroupId() : plans.findGroupIdByClave(planId, c.standardGroupKey()), c.standardGroupKey(), c.porciones())).toList();
        return new FoodRuleDto(r.id(), r.alcance(), r.planId(), r.userId(), r.alimento(), r.sinonimos(), r.tipo(), r.standardGroupKey(), group,
            components, r.cantidadPorPorcion(), r.unidad(), r.porcionPorDefecto(), r.uid(), r.overridesRuleUid());
    }
    private PlanRulesDto.RuleDto dto(FoodRuleDto original, Long planId, List<PlanFoodGroupDto> groups) {
        FoodRuleDto r = resolve(original, planId);
        Map<Long, UUID> uids = groups.stream().collect(Collectors.toMap(PlanFoodGroupDto::id, PlanFoodGroupDto::uid));
        Map<Long, String> names = groups.stream().collect(Collectors.toMap(PlanFoodGroupDto::id, PlanFoodGroupDto::name));
        return new PlanRulesDto.RuleDto(r.uid(), r.alcance(), r.alimento(), r.sinonimos(), r.tipo(), uids.get(r.foodGroupId()),
            r.cantidadPorPorcion(), r.unidad(), r.porcionPorDefecto(), r.componentes().stream()
                .map(c -> new PlanRulesDto.ComponentDto(uids.get(c.foodGroupId()), c.porciones())).toList(), r.overridesRuleUid(), RuleText.describe(r, names));
    }
    private PlanRulesDto mutate(String email, Long version, Consumer<PlanRef> validate, java.util.function.BiConsumer<Long, Long> change) {
        Long user = users.findUserIdByEmail(email);
        plans.lockCurrentPlan(user);
        PlanRef cur = plans.currentPlanRef(user);
        if (!Objects.equals(cur.version(), version)) throw new PlanVersionConflictException();
        validate.accept(cur);
        boolean used = notes.planHasNotes(cur.id()) || entries.hasEntriesForMeals(plans.getMealIds(cur.id())) || habits.planHasLogs(cur.id());
        Long editable = used ? plans.forkCurrentPlan(user) : cur.id();
        change.accept(user, editable);
        if (used) notes.reinterpretTodayNotes(email, editable);
        if (!used) plans.checkAndBumpVersion(editable, version);
        return aggregate(user);
    }
    PlanRulesDto group(String email, UUID uid, Requests.Group req) {
        return mutate(email, req.planVersion(), cur -> { if (uid != null) plans.findGroupIdByUid(cur.id(), uid); },
            (user, id) -> { if (uid == null) plans.createGroup(id, req.input()); else plans.updateGroup(id, uid, req.input()); });
    }
    PlanRulesDto order(String email, Requests.Order req) {
        return mutate(email, req.planVersion(), cur -> {
            var all = plans.getPlanFoodGroups(cur.id()).stream().map(PlanFoodGroupDto::uid).collect(Collectors.toSet());
            if (req.uids().size() != all.size() || !all.equals(new HashSet<>(req.uids()))) throw new IllegalArgumentException("Indicá todos los grupos del plan una sola vez.");
        }, (user, id) -> plans.reorderGroups(id, req.uids()));
    }
    PlanRulesDto deleteGroup(String email, UUID uid, Long version) {
        return mutate(email, version, cur -> plans.findGroupIdByUid(cur.id(), uid), (user, id) -> {
            Long groupId = plans.findGroupIdByUid(id, uid);
            int meals = plans.countMealPortions(id, groupId), foods = rules.countGroupReferences(id, groupId);
            if (meals + foods > 0) throw new GroupInUseException(plans.getPlanFoodGroups(id).stream().filter(g -> g.uid().equals(uid)).findFirst().orElseThrow().name(), meals, foods);
            entries.detachGroup(groupId);
            plans.deleteGroup(id, uid);
        });
    }
    private RuleInput input(Long id, Requests.Rule req) {
        if (req.overridesRuleUid() != null) rules.getRuleForAdjust(req.overridesRuleUid(), id);
        return new RuleInput(req.alimento(), req.sinonimos(), req.tipo(), req.groupUid() == null ? null : plans.findGroupIdByUid(id, req.groupUid()),
            req.cantidadPorPorcion(), req.unidad(), req.porcionPorDefecto(), req.componentes() == null ? List.of() : req.componentes().stream()
                .map(c -> new Componente(plans.findGroupIdByUid(id, c.groupUid()), null, c.porciones())).toList(), req.overridesRuleUid());
    }
    private void requireUserRule(Long user, Long id, UUID uid) {
        if (rules.getUserRules(user, id).stream().noneMatch(r -> r.uid().equals(uid))) throw missing();
    }
    PlanRulesDto rule(String email, UUID uid, Requests.Rule req) {
        Long user = users.findUserIdByEmail(email);
        return mutate(email, req.planVersion(), cur -> { input(cur.id(), req); if (uid != null) requireUserRule(user, cur.id(), uid); },
            (u, id) -> { if (uid == null) rules.createUserRule(u, id, input(id, req)); else rules.updateUserRule(u, id, uid, input(id, req)); });
    }
    PlanRulesDto deleteRule(String email, UUID uid, Long version) {
        Long user = users.findUserIdByEmail(email);
        return mutate(email, version, cur -> requireUserRule(user, cur.id(), uid), (u, id) -> rules.deleteUserRule(u, id, uid));
    }
    PlanRulesDto habit(String email, UUID uid, Requests.Habit req) {
        return mutate(email, req.planVersion(), cur -> { if (uid != null) requireHabit(cur.id(), uid); },
            (u, id) -> { if (uid == null) habits.createHabit(id, req.input()); else habits.updateHabit(id, uid, req.input()); });
    }
    private void requireHabit(Long id, UUID uid) { if (habits.listHabits(id).stream().noneMatch(h -> h.uid().equals(uid))) throw missing(); }
    PlanRulesDto deleteHabit(String email, UUID uid, Long version) {
        return mutate(email, version, cur -> requireHabit(cur.id(), uid), (u, id) -> habits.removeHabit(id, uid));
    }
    private ResponseStatusException missing() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "No se encontró el recurso en tu plan."); }
    @Transactional(readOnly=true)
    List<PlanRulesDto.CatalogDto> catalog(String email, String q) {
        Long user = users.findUserIdByEmail(email); Long id = plans.currentPlanRef(user).id();
        var adjustments = rules.getUserRules(user, id).stream().filter(r -> r.overridesRuleUid() != null)
            .collect(Collectors.toMap(FoodRuleDto::overridesRuleUid, FoodRuleDto::uid));
        var groups = plans.getPlanFoodGroups(id);
        return rules.searchCatalog(q, id, user, 30).stream().map(r -> {
            var d = dto(r, id, groups);
            return new PlanRulesDto.CatalogDto(d.uid(), d.alcance(), d.alimento(), d.sinonimos(), d.tipo(), d.groupUid(), d.textoRegla(), adjustments.get(d.uid()));
        }).toList();
    }
    PlanRulesDto adjust(String email, UUID uid, Requests.Version req) {
        return mutate(email, req.planVersion(), cur -> rules.getRuleForAdjust(uid, cur.id()), (u, id) -> {
            FoodRuleDto r = resolve(rules.getRuleForAdjust(uid, id), id);
            if ("NORMAL".equals(r.tipo()) && r.foodGroupId() == null) throw new InvalidRuleException("No hay un grupo del plan para la clave de este alimento.");
            rules.createUserRule(u, id, new RuleInput(r.alimento(), r.sinonimos(), r.tipo(), r.foodGroupId(), r.cantidadPorPorcion(), r.unidad(), r.porcionPorDefecto(), r.componentes(), uid));
        });
    }
}
