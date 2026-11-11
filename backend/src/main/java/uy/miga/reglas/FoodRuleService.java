package uy.miga.reglas;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class FoodRuleService {

    private final FoodRuleRepository repository;

    private final org.springframework.context.ApplicationEventPublisher events;

    FoodRuleService(FoodRuleRepository repository, org.springframework.context.ApplicationEventPublisher events) {
        this.repository = repository;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public List<FoodRuleDto> findApplicable(Long planId, Long userId) {
        var all = repository.findApplicable(planId, userId);
        var overrides = all.stream().filter(r -> "USUARIO".equals(r.getScope()))
            .map(FoodRule::getOverridesRuleUid).filter(Objects::nonNull).collect(Collectors.toSet());
        return all.stream().filter(r -> !overrides.contains(r.getUid())).map(r -> {
            FoodRuleDto dto = toDto(r);
            if (r.getOverridesRuleUid() == null) return dto;
            var source = all.stream().filter(original -> original.getUid().equals(r.getOverridesRuleUid())).findFirst();
            if (source.isEmpty()) return dto;
            var aliases = new LinkedHashSet<String>();
            if (dto.synonyms() != null) aliases.addAll(dto.synonyms());
            aliases.add(source.get().getFood());
            if (source.get().getSynonyms() != null) aliases.addAll(source.get().getSynonyms());
            return new FoodRuleDto(dto.id(), dto.scope(), dto.planId(), dto.userId(), dto.food(), List.copyOf(aliases),
                dto.type(), dto.standardGroupKey(), dto.foodGroupId(), dto.components(), dto.amountPerPortion(),
                dto.unit(), dto.defaultPortions(), dto.uid(), dto.overridesRuleUid());
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<FoodRuleDto> getUserRules(Long userId, Long planId) {
        return repository.findByUserIdAndPlanIdAndScope(userId, planId, "USUARIO")
            .stream().map(this::toDto).toList();
    }

    @Transactional
    public FoodRuleDto createUserRule(Long userId, Long planId, Long foodGroupId,
                                     String food, List<String> synonyms,
                                     BigDecimal amountPerPortion, String unit,
                                     BigDecimal defaultPortions) {
        return createUserRule(userId, planId, new RuleInput(food, synonyms, "NORMAL", foodGroupId,
            amountPerPortion, unit, defaultPortions, List.of(), null));
    }

    @Transactional
    public void deleteUserRule(Long ruleId, Long userId) {
        FoodRule rule = repository.findById(ruleId)
            .filter(r -> userId.equals(r.getUserId()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        repository.delete(rule);
    }

    private FoodRuleDto toDto(FoodRule r) {
        return new FoodRuleDto(r.getId(), r.getScope(), r.getPlanId(), r.getUserId(),
            r.getFood(), r.getSynonyms(), r.getType(), r.getStandardGroupKey(),
            r.getFoodGroupId(), r.getComponents(), r.getAmountPerPortion(),
            r.getUnit(), r.getDefaultPortions(), r.getUid(), r.getOverridesRuleUid());
    }

    @Transactional(readOnly = true)
    public List<FoodRuleDto> getPlanRules(Long planId, Long userId) {
        return repository.findApplicable(planId, userId).stream().filter(r -> !"GLOBAL".equals(r.getScope())).map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<FoodRuleDto> searchCatalog(String q, Long planId, Long userId, int limit) {
        String query = normalize(q == null ? "" : q);
        return repository.findApplicable(planId, userId).stream().filter(r -> !"USUARIO".equals(r.getScope()))
            .filter(r -> normalize(r.getFood()).contains(query) || (r.getSynonyms() != null &&
                r.getSynonyms().stream().anyMatch(s -> normalize(s).contains(query))))
            .limit(Math.max(0, Math.min(30, limit))).map(this::toDto).toList();
    }

    private String normalize(String s) {
        return Normalizer.normalize(s == null ? "" : s.strip(), Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
    }

    @Transactional(readOnly = true)
    public FoodRuleDto getRuleForAdjust(UUID uid, Long planId) {
        return repository.findForAdjust(uid, planId).map(this::toDto)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alimento no encontrado."));
    }

    @Transactional(readOnly = true)
    public FoodRuleDto getRuleForResolve(UUID uid, Long userId, Long itemPlanId, Long currentPlanId) {
        var rules = new ArrayList<>(repository.findApplicable(itemPlanId, userId));
        if (currentPlanId != null && !currentPlanId.equals(itemPlanId)) {
            rules.addAll(repository.findApplicable(currentPlanId, userId));
        }
        return rules.stream().filter(r -> uid.equals(r.getUid())).findFirst().map(this::toDto)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alimento no encontrado."));
    }

    private FoodRule userRule(Long userId, Long planId, UUID uid) {
        return repository.findByUserIdAndPlanIdAndScope(userId, planId, "USUARIO").stream()
            .filter(r -> r.getUid().equals(uid)).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alimento no encontrado."));
    }

    @Transactional
    public FoodRuleDto createUserRule(Long userId, Long planId, RuleInput in) {
        repository.lockUserRules(userId, planId);
        checkDuplicateName(userId, planId, null, in.food());
        FoodRule rule = new FoodRule();
        rule.setUserId(userId);
        rule.setPlanId(planId);
        rule.setScope("USUARIO");
        apply(rule, in);
        return toDto(repository.save(rule));
    }

    @Transactional(readOnly = true)
    public boolean hasUserRuleNamed(Long userId, Long planId, String name) {
        return repository.findByUserIdAndPlanIdAndScope(userId, planId, "USUARIO").stream()
            .anyMatch(r -> normalize(r.getFood()).equals(normalize(name)));
    }

    @Transactional
    public FoodRuleDto upsertUserRule(Long userId, Long planId, RuleInput in) {
        repository.lockUserRules(userId, planId);
        var existing = repository.findByUserIdAndPlanIdAndScope(userId, planId, "USUARIO").stream()
            .filter(r -> normalize(r.getFood()).equals(normalize(in.food())))
            .findFirst();
        if (existing.isEmpty()) {
            FoodRule rule = new FoodRule();
            rule.setUserId(userId);
            rule.setPlanId(planId);
            rule.setScope("USUARIO");
            apply(rule, in);
            return toDto(repository.save(rule));
        }
        FoodRule rule = existing.get();
        var aliases = new LinkedHashMap<String, String>();
        if (rule.getSynonyms() != null) {
            rule.getSynonyms().forEach(alias -> aliases.putIfAbsent(normalize(alias), alias));
        }
        if (in.synonyms() != null) {
            in.synonyms().forEach(alias -> aliases.putIfAbsent(normalize(alias), alias));
        }
        apply(rule, new RuleInput(in.food(), List.copyOf(aliases.values()), in.type(), in.foodGroupId(),
            in.amountPerPortion(), in.unit(), in.defaultPortions(), in.components(),
            in.overridesRuleUid() != null ? in.overridesRuleUid() : rule.getOverridesRuleUid()));
        events.publishEvent(new UserRuleReused(userId, rule.getUid()));
        return toDto(rule);
    }

    @Transactional
    public FoodRuleDto updateUserRule(Long userId, Long planId, UUID uid, RuleInput in) {
        FoodRule rule = userRule(userId, planId, uid);
        checkDuplicateName(userId, planId, uid, in.food());
        apply(rule, in);
        events.publishEvent(new UserRuleReused(userId, rule.getUid()));
        return toDto(rule);
    }

    @Transactional
    public void deleteUserRule(Long userId, Long planId, UUID uid) { repository.delete(userRule(userId, planId, uid)); }

    private void checkDuplicateName(Long userId, Long planId, UUID excludedUid, String name) {
        if (repository.findByUserIdAndPlanIdAndScope(userId, planId, "USUARIO").stream()
            .anyMatch(rule -> !rule.getUid().equals(excludedUid)
                && normalize(rule.getFood()).equals(normalize(name)))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Ya tenés un alimento con ese nombre. Editalo en lugar de crear otro.");
        }
    }

    private static void validateNames(String name, List<String> synonyms, FoodRule existing) {
        List<String> previous = existing == null || existing.getSynonyms() == null ? List.of() : existing.getSynonyms();
        if (name == null || name.isBlank() || (name.length() > 100 &&
            (existing == null || !name.equals(existing.getFood()))))
            throw new InvalidRuleException("Ingresá un nombre de alimento de hasta 100 caracteres.");
        if (synonyms != null && (synonyms.size() > Math.max(20, previous.size()) ||
            (previous.size() > 20 && synonyms.stream().anyMatch(s -> !previous.contains(s))) || synonyms.stream()
            .anyMatch(s -> s == null || s.isBlank() || (s.length() > 100 && !previous.contains(s)))))
            throw new InvalidRuleException("Podés indicar hasta 20 sinónimos de hasta 100 caracteres cada uno.");
    }

    private void apply(FoodRule rule, RuleInput in) {
        validateNames(in.food(), in.synonyms(), rule);
        if (in.type() == null || !List.of("NORMAL", "COMPUESTO", "LIBRE", "FLEXIBLE", "NO_CUENTA").contains(in.type()) ||
            (in.defaultPortions() != null && in.defaultPortions().signum() <= 0))
            throw new InvalidRuleException("Nombre, tipo o porción por defecto inválidos.");
        boolean components = in.components() != null && !in.components().isEmpty();
        if ("NORMAL".equals(in.type())) {
            boolean noMeasure = in.amountPerPortion() == null && in.unit() == null;
            if (in.foodGroupId() == null || components || !(noMeasure || hasPositiveMeasure(in))) {
                throw new InvalidRuleException("El alimento normal requiere grupo y cantidad positiva con unidad, o ambos vacíos.");
            }
        } else if ("COMPUESTO".equals(in.type())) {
            if (in.amountPerPortion() != null && !hasPositiveMeasure(in)) {
                throw new InvalidRuleException("El compuesto requiere cantidad positiva y unidad juntas, o ambas vacías.");
            }
            if (in.foodGroupId() != null || !components || !validComponents(in.components())) {
                throw new InvalidRuleException("El compuesto requiere al menos dos grupos distintos con porciones positivas.");
            }
        } else if (in.foodGroupId() != null || components) {
            throw new InvalidRuleException("Este tipo no admite grupos ni componentes.");
        }
        if (in.unit() != null && in.unit().length() > 20) throw new InvalidRuleException("La unidad admite hasta 20 caracteres.");
        if (in.overridesRuleUid() != null && hasOtherAdjustment(rule, in.overridesRuleUid())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un ajuste de este alimento.");
        }
        rule.setFood(in.food().strip());
        rule.setSynonyms(in.synonyms() == null ? List.of() : in.synonyms());
        rule.setType(in.type());
        rule.setFoodGroupId(in.foodGroupId());
        rule.setAmountPerPortion(in.amountPerPortion());
        // Los compuestos guardados antes con unidad y sin cantidad conservan su comportamiento: la unidad suelta se descarta.
        rule.setUnit("COMPUESTO".equals(in.type()) && in.amountPerPortion() == null ? null : in.unit());
        rule.setDefaultPortions(in.defaultPortions() == null ? BigDecimal.ONE : in.defaultPortions());
        rule.setComponents(in.components());
        rule.setOverridesRuleUid(in.overridesRuleUid());
    }

    private static boolean hasPositiveMeasure(RuleInput in) {
        return in.amountPerPortion() != null && in.amountPerPortion().signum() > 0
            && in.unit() != null && !in.unit().isBlank();
    }

    private static boolean validComponents(List<RuleComponent> components) {
        boolean allPositive = components.stream().allMatch(c -> c != null && c.foodGroupId() != null
            && Double.isFinite(c.portions()) && c.portions() > 0);
        return components.size() >= 2 && allPositive
            && components.stream().map(RuleComponent::foodGroupId).distinct().count() == components.size();
    }

    private boolean hasOtherAdjustment(FoodRule rule, UUID overridden) {
        return repository.findByUserIdAndPlanIdAndScope(rule.getUserId(), rule.getPlanId(), "USUARIO").stream()
            .anyMatch(other -> !other.getUid().equals(rule.getUid()) && overridden.equals(other.getOverridesRuleUid()));
    }

    @Transactional(readOnly = true)
    public int countGroupReferences(Long planId, Long groupId) {
        return (int)repository.findByPlanIdAndScopeIn(planId, List.of("PLAN", "USUARIO")).stream()
            .filter(r -> groupId.equals(r.getFoodGroupId()) || (r.getComponents() != null &&
                r.getComponents().stream().anyMatch(c -> groupId.equals(c.foodGroupId())))).count();
    }
}
