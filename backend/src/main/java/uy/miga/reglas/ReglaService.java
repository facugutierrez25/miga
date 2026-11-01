package uy.miga.reglas;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@Service
public class ReglaService {

    private final FoodRuleRepository repository;

    ReglaService(FoodRuleRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<FoodRuleDto> findApplicable(Long planId, Long userId) {
        var all = repository.findApplicable(planId, userId);
        var overrides = all.stream().filter(r -> "USUARIO".equals(r.getAlcance()))
            .map(FoodRule::getOverridesRuleUid).filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.toSet());
        return all.stream().filter(r -> !overrides.contains(r.getUid())).map(r -> {
            FoodRuleDto dto = toDto(r);
            if (r.getOverridesRuleUid() == null) return dto;
            var source = all.stream().filter(original -> original.getUid().equals(r.getOverridesRuleUid())).findFirst();
            if (source.isEmpty()) return dto;
            var aliases = new java.util.LinkedHashSet<String>();
            if (dto.sinonimos() != null) aliases.addAll(dto.sinonimos());
            aliases.add(source.get().getAlimento());
            if (source.get().getSinonimos() != null) aliases.addAll(source.get().getSinonimos());
            return new FoodRuleDto(dto.id(), dto.alcance(), dto.planId(), dto.userId(), dto.alimento(), List.copyOf(aliases), dto.tipo(),
                dto.standardGroupKey(), dto.foodGroupId(), dto.componentes(), dto.cantidadPorPorcion(), dto.unidad(), dto.porcionPorDefecto(), dto.uid(), dto.overridesRuleUid());
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<FoodRuleDto> getUserRules(Long userId, Long planId) {
        return repository.findByUserIdAndPlanIdAndAlcance(userId, planId, "USUARIO")
            .stream().map(this::toDto).toList();
    }

    @Transactional
    public FoodRuleDto createUserRule(Long userId, Long planId, Long foodGroupId,
                                     String alimento, List<String> sinonimos,
                                     BigDecimal cantidadPorPorcion, String unidad,
                                     BigDecimal porcionPorDefecto) {
        validateNames(alimento, sinonimos);
        FoodRule rule = new FoodRule();
        rule.setAlcance("USUARIO");
        rule.setUserId(userId);
        rule.setPlanId(planId);
        rule.setFoodGroupId(foodGroupId);
        rule.setAlimento(alimento.strip());
        rule.setSinonimos(sinonimos);
        rule.setTipo("NORMAL");
        rule.setCantidadPorPorcion(cantidadPorPorcion);
        rule.setUnidad(unidad);
        rule.setPorcionPorDefecto(porcionPorDefecto != null ? porcionPorDefecto : BigDecimal.ONE);
        return toDto(repository.save(rule));
    }

    @Transactional
    public void deleteUserRule(Long ruleId, Long userId) {
        FoodRule rule = repository.findById(ruleId)
            .filter(r -> userId.equals(r.getUserId()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        repository.delete(rule);
    }

    private FoodRuleDto toDto(FoodRule r) {
        return new FoodRuleDto(r.getId(), r.getAlcance(), r.getPlanId(), r.getUserId(),
            r.getAlimento(), r.getSinonimos(), r.getTipo(), r.getStandardGroupKey(),
            r.getFoodGroupId(), r.getComponentes(), r.getCantidadPorPorcion(),
            r.getUnidad(), r.getPorcionPorDefecto(), r.getUid(), r.getOverridesRuleUid());
    }

    @Transactional(readOnly = true)
    public List<FoodRuleDto> getPlanRules(Long planId, Long userId) {
        return repository.findApplicable(planId, userId).stream().filter(r -> !"GLOBAL".equals(r.getAlcance())).map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<FoodRuleDto> searchCatalog(String q, Long planId, Long userId, int limit) {
        String query = normalize(q == null ? "" : q);
        return repository.findApplicable(planId, userId).stream().filter(r -> !"USUARIO".equals(r.getAlcance()))
            .filter(r -> normalize(r.getAlimento()).contains(query) || (r.getSinonimos() != null &&
                r.getSinonimos().stream().anyMatch(s -> normalize(s).contains(query))))
            .limit(Math.max(0, Math.min(30, limit))).map(this::toDto).toList();
    }

    private String normalize(String s) {
        return java.text.Normalizer.normalize(s == null ? "" : s.strip(), java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(java.util.Locale.ROOT);
    }

    @Transactional(readOnly = true)
    public FoodRuleDto getRuleForAdjust(java.util.UUID uid, Long planId) {
        return repository.findForAdjust(uid, planId).map(this::toDto).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alimento no encontrado."));
    }

    private FoodRule userRule(Long userId, Long planId, java.util.UUID uid) {
        return repository.findByUserIdAndPlanIdAndAlcance(userId, planId, "USUARIO").stream()
            .filter(r -> r.getUid().equals(uid)).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alimento no encontrado."));
    }

    @Transactional
    public FoodRuleDto createUserRule(Long userId, Long planId, RuleInput in) {
        checkDuplicateName(userId, planId, null, in.alimento());
        FoodRule rule = new FoodRule();
        rule.setUserId(userId);
        rule.setPlanId(planId);
        rule.setAlcance("USUARIO");
        apply(rule, in); return toDto(repository.save(rule));
    }

    @Transactional
    public FoodRuleDto upsertUserRule(Long userId, Long planId, RuleInput in) {
        var existing = repository.findByUserIdAndPlanIdAndAlcance(userId, planId, "USUARIO").stream()
            .filter(r -> normalize(r.getAlimento()).equals(normalize(in.alimento())))
            .findFirst();
        if (existing.isEmpty()) {
            return createUserRule(userId, planId, in);
        }
        FoodRule rule = existing.get();
        var aliases = new java.util.LinkedHashMap<String, String>();
        if (rule.getSinonimos() != null) {
            rule.getSinonimos().forEach(alias -> aliases.putIfAbsent(normalize(alias), alias));
        }
        if (in.sinonimos() != null) {
            in.sinonimos().forEach(alias -> aliases.putIfAbsent(normalize(alias), alias));
        }
        apply(rule, new RuleInput(in.alimento(), List.copyOf(aliases.values()), in.tipo(), in.foodGroupId(),
            in.cantidadPorPorcion(), in.unidad(), in.porcionPorDefecto(), in.componentes(), rule.getOverridesRuleUid()));
        return toDto(rule);
    }

    @Transactional
    public FoodRuleDto updateUserRule(Long userId, Long planId, java.util.UUID uid, RuleInput in) {
        FoodRule rule = userRule(userId, planId, uid);
        checkDuplicateName(userId, planId, uid, in.alimento());
        apply(rule, in);
        return toDto(rule);
    }

    @Transactional
    public void deleteUserRule(Long userId, Long planId, java.util.UUID uid) { repository.delete(userRule(userId, planId, uid)); }

    private void checkDuplicateName(Long userId, Long planId, java.util.UUID excludedUid, String name) {
        if (repository.findByUserIdAndPlanIdAndAlcance(userId, planId, "USUARIO").stream()
            .anyMatch(rule -> !rule.getUid().equals(excludedUid)
                && normalize(rule.getAlimento()).equals(normalize(name)))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Ya tenés un alimento con ese nombre. Editalo en lugar de crear otro.");
        }
    }

    private static void validateNames(String name, List<String> synonyms) {
        validateNames(name, synonyms, null);
    }

    private static void validateNames(String name, List<String> synonyms, FoodRule existing) {
        List<String> previous = existing == null || existing.getSinonimos() == null ? List.of() : existing.getSinonimos();
        if (name == null || name.isBlank() || (name.length() > 100 &&
            (existing == null || !name.equals(existing.getAlimento()))))
            throw new InvalidRuleException("Ingresá un nombre de alimento de hasta 100 caracteres.");
        if (synonyms != null && (synonyms.size() > Math.max(20, previous.size()) ||
            (previous.size() > 20 && synonyms.stream().anyMatch(s -> !previous.contains(s))) || synonyms.stream()
            .anyMatch(s -> s == null || s.isBlank() || (s.length() > 100 && !previous.contains(s)))))
            throw new InvalidRuleException("Podés indicar hasta 20 sinónimos de hasta 100 caracteres cada uno.");
    }

    private void apply(FoodRule rule, RuleInput in) {
        validateNames(in.alimento(), in.sinonimos(), rule);
        if (in.tipo() == null || !List.of("NORMAL", "COMPUESTO", "LIBRE", "FLEXIBLE", "NO_CUENTA").contains(in.tipo()) ||
            (in.porcionPorDefecto() != null && in.porcionPorDefecto().signum() <= 0))
            throw new InvalidRuleException("Nombre, tipo o porción por defecto inválidos.");
        boolean components = in.componentes() != null && !in.componentes().isEmpty();
        if ("NORMAL".equals(in.tipo())) {
            if (in.foodGroupId() == null || components || !((in.cantidadPorPorcion() == null && in.unidad() == null) ||
                (in.cantidadPorPorcion() != null && in.cantidadPorPorcion().signum() > 0 && in.unidad() != null && !in.unidad().isBlank())))
                throw new InvalidRuleException("El alimento normal requiere grupo y cantidad positiva con unidad, o ambos vacíos.");
        } else if ("COMPUESTO".equals(in.tipo())) {
            if (in.cantidadPorPorcion() != null && (in.cantidadPorPorcion().signum() <= 0 || in.unidad() == null || in.unidad().isBlank()))
                throw new InvalidRuleException("El compuesto requiere cantidad positiva y unidad juntas, o ambas vacías.");
            if (in.foodGroupId() != null || !components || in.componentes().size() < 2 ||
                in.componentes().stream().anyMatch(c -> c == null || c.foodGroupId() == null || !Double.isFinite(c.porciones()) || c.porciones() <= 0) ||
                in.componentes().stream().map(Componente::foodGroupId).distinct().count() != in.componentes().size())
                throw new InvalidRuleException("El compuesto requiere al menos dos grupos distintos con porciones positivas.");
        } else if (in.foodGroupId() != null || components) throw new InvalidRuleException("Este tipo no admite grupos ni componentes.");
        if (in.unidad() != null && in.unidad().length() > 20) throw new InvalidRuleException("La unidad admite hasta 20 caracteres.");
        if (in.overridesRuleUid() != null && repository.findByUserIdAndPlanIdAndAlcance(rule.getUserId(), rule.getPlanId(), "USUARIO").stream()
            .anyMatch(r -> !r.getUid().equals(rule.getUid()) && in.overridesRuleUid().equals(r.getOverridesRuleUid())))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un ajuste de este alimento.");
        rule.setAlimento(in.alimento().strip()); rule.setSinonimos(in.sinonimos() == null ? List.of() : in.sinonimos());
        rule.setTipo(in.tipo()); rule.setFoodGroupId(in.foodGroupId()); rule.setCantidadPorPorcion(in.cantidadPorPorcion());
        // Los compuestos guardados antes con unidad y sin cantidad conservan su comportamiento: la unidad suelta se descarta.
        rule.setUnidad("COMPUESTO".equals(in.tipo()) && in.cantidadPorPorcion() == null ? null : in.unidad()); rule.setPorcionPorDefecto(in.porcionPorDefecto() == null ? BigDecimal.ONE : in.porcionPorDefecto());
        rule.setComponentes(in.componentes()); rule.setOverridesRuleUid(in.overridesRuleUid());
    }

    @Transactional(readOnly = true)
    public int countGroupReferences(Long planId, Long groupId) {
        return (int)repository.findByPlanIdAndAlcanceIn(planId, List.of("PLAN", "USUARIO")).stream()
            .filter(r -> groupId.equals(r.getFoodGroupId()) || (r.getComponentes() != null &&
                r.getComponentes().stream().anyMatch(c -> groupId.equals(c.foodGroupId())))).count();
    }
}
