package uy.miga.plans;

import org.springframework.stereotype.Service;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;
import uy.miga.users.UserService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PlanService {

    private static final List<Object[]> DEFAULT_GROUPS = List.of(
        new Object[]{"Proteínas", "PRO", 1, "proteinas"},
        new Object[]{"Cereales",  "CER", 2, "cereales_tuberculos"},
        new Object[]{"Frutas",    "FRU", 3, "frutas"},
        new Object[]{"Lácteos",   "LAC", 4, "lacteos"},
        new Object[]{"Grasas",    "GRA", 5, "aceites_grasas"},
        new Object[]{"Verduras",  "VER", 6, "verduras"}
    );

    static final Map<String, String> ABBR_TO_CLAVE = Map.of(
        "PRO", "proteinas",
        "CER", "cereales_tuberculos",
        "PAN", "panificados",
        "VER", "verduras",
        "FRU", "frutas",
        "LAC", "lacteos",
        "HUE", "huevos",
        "GRA", "aceites_grasas",
        "DUL", "dulces"
    );

    private final jakarta.persistence.EntityManager entityManager;

    private final PlansRepository plansRepository;
    private final PlanFoodGroupRepository groupRepository;
    private final MealRepository mealRepository;
    private final UserService userService;
    private final ApplicationEventPublisher events;
    private final java.time.Clock clock;

    PlanService(PlansRepository plansRepository,
                PlanFoodGroupRepository groupRepository,
                MealRepository mealRepository,
                UserService userService, ApplicationEventPublisher events, jakarta.persistence.EntityManager entityManager, java.time.Clock clock) {
        this.clock = clock;
        this.entityManager = entityManager;
        this.events = events;
        this.plansRepository = plansRepository;
        this.groupRepository = groupRepository;
        this.mealRepository = mealRepository;
        this.userService = userService;
    }

    @Transactional(readOnly = true)
    public Long getCurrentPlanId(String email) {
        Long userId = userService.findUserIdByEmail(email);
        return plansRepository.findByUserIdAndCurrentTrue(userId)
            .map(Plan::getId)
            .orElseThrow(PlanNotFoundException::new);
    }

    @Transactional(readOnly = true, noRollbackFor = PlanNotFoundException.class)
    public Long getPlanIdForDate(Long userId, LocalDate date) {
        return plansRepository.findActiveOnDate(userId, date, clock.getZone().getId())
            .or(() -> plansRepository.findOldestByUserId(userId))
            .map(Plan::getId)
            .orElseThrow(PlanNotFoundException::new);
    }

    @Transactional(readOnly = true)
    PlanDto getMyPlan(String email) {
        Long userId = userService.findUserIdByEmail(email);
        Plan plan = plansRepository.findByUserIdAndCurrentTrue(userId)
            .orElseThrow(PlanNotFoundException::new);
        return toDto(plan);
    }

    @Transactional
    PlanDto saveMyPlan(String email, PlanSaveDto dto) {
        validatePortions(dto);
        Long userId = userService.findUserIdByEmail(email);

        var existing = plansRepository.lockCurrentByUserId(userId)
            .or(() -> plansRepository.lockCurrentByUserId(userId));
        // Con un plan vigente, la versión es obligatoria: sin ella el cliente cree que está
        // creando el primer plan y otro ya lo creó. Sin plan vigente, una versión indica un
        // cliente desactualizado. La creación concurrente la frena el índice único de V23.
        if (existing.isEmpty() && dto.clientVersion() != null) {
            throw new PlanConflictException();
        }
        if (existing.isPresent()) {
            Plan old = existing.get();
            if (!old.getVersion().equals(dto.clientVersion())) {
                throw new PlanConflictException();
            }
            if (!planChanged(old, dto)) {
                return toDto(old);
            }
            old.setCurrent(false);
            old.setSupersededAt(OffsetDateTime.now());
            plansRepository.save(old);
            plansRepository.flush();
        }

        Plan savedPlan = copyPlan(userId, existing);

        Map<String, Long> abbrToId = savedPlan.getFoodGroups().stream()
            .collect(Collectors.toMap(PlanFoodGroup::getAbbreviation, PlanFoodGroup::getId));

        buildMeals(savedPlan, dto, abbrToId);
        plansRepository.flush();
        if (existing.isPresent()) {
            completeVersion(existing.get(), savedPlan);
        }
        return toDto(savedPlan);
    }

    @Transactional(readOnly = true)
    List<PlanSummaryDto> getPlanHistory(String email) {
        Long userId = userService.findUserIdByEmail(email);
        return plansRepository.findTop50ByUserIdAndCurrentFalseOrderBySupersededAtDescIdDesc(userId)
            .stream()
            .map(p -> {
                List<PlanFoodGroupDto> groups = toGroupDtos(p.getFoodGroups());
                List<MealSummaryDto> meals = p.getMeals().stream().map(meal -> new MealSummaryDto(
                    meal.getName(),
                    meal.getPortions().stream()
                        .filter(por -> por.getPortions().compareTo(BigDecimal.ZERO) > 0)
                        .map(por -> new MealPortionDto(por.getFoodGroupId(), por.getPortions()))
                        .toList()
                )).toList();
                return new PlanSummaryDto(
                    p.getCreatedAt().atZoneSameInstant(clock.getZone()).toLocalDate(),
                    p.getSupersededAt().atZoneSameInstant(clock.getZone()).toLocalDate(),
                    p.getMeals().size(),
                    groups,
                    meals
                );
            })
            .toList();
    }

    private Plan copyPlan(Long userId, java.util.Optional<Plan> existing) {
        Plan plan = new Plan();
        plan.setUserId(userId);
        if (existing.isPresent()) {
            Plan old = existing.get();
            plan.setModoRegistro(old.getModoRegistro());
            plan.setMargenPorciones(old.getMargenPorciones());
            for (PlanFoodGroup source : old.getFoodGroups()) {
                PlanFoodGroup group = new PlanFoodGroup(plan, source.getName(),
                    source.getAbbreviation(), (short) source.getDisplayOrder());
                group.setUid(source.getUid());
                group.setClave(source.getClave());
                group.setColor(source.getColor());
                group.setPreguntarSiFalta(source.isPreguntarSiFalta());
                group.setOpcional(source.isOpcional());
                plan.getFoodGroups().add(group);
            }
        } else {
            createDefaultFoodGroups(plan);
        }
        Plan savedPlan = plansRepository.saveAndFlush(plan);

        return savedPlan;
    }

    private void createDefaultFoodGroups(Plan plan) {
        for (Object[] g : DEFAULT_GROUPS) {
            PlanFoodGroup group = new PlanFoodGroup(plan, (String) g[0], (String) g[1], (short)(int) g[2]);
            group.setClave((String) g[3]);
            group.setColor(GroupColors.forKey((String) g[3]));
            plan.getFoodGroups().add(group);
        }
    }

    private void buildMeals(Plan plan, PlanSaveDto dto, Map<String, Long> abbrToId) {
        for (MealSaveDto mealDto : dto.meals()) {
            Meal meal = new Meal();
            meal.setPlan(plan);
            meal.setName(mealDto.name());
            meal.setSuggestedTime(mealDto.suggestedTime());
            meal.setDisplayOrder(mealDto.displayOrder());
            for (MealPortionInput input : mealDto.portions()) {
                Long groupId = abbrToId.get(input.foodGroupAbbr());
                if (groupId == null) throw new InvalidPortionsException();
                MealPortion portion = new MealPortion();
                portion.setMeal(meal);
                portion.setFoodGroupId(groupId);
                portion.setPortions(input.portions());
                meal.getPortions().add(portion);
            }
            plan.getMeals().add(meal);
        }
    }

    private boolean planChanged(Plan current, PlanSaveDto dto) {
        Map<Long, String> idToAbbr = current.getFoodGroups().stream()
            .collect(Collectors.toMap(PlanFoodGroup::getId, PlanFoodGroup::getAbbreviation));

        List<Meal> currentMeals = current.getMeals().stream()
            .sorted(java.util.Comparator.comparingInt(Meal::getDisplayOrder))
            .toList();
        List<MealSaveDto> newMeals = dto.meals().stream()
            .sorted(java.util.Comparator.comparingInt(MealSaveDto::displayOrder))
            .toList();

        if (currentMeals.size() != newMeals.size()) return true;

        for (int i = 0; i < currentMeals.size(); i++) {
            Meal cm = currentMeals.get(i);
            MealSaveDto nm = newMeals.get(i);
            if (!cm.getName().equals(nm.name())) return true;
            if (!java.util.Objects.equals(cm.getSuggestedTime(), nm.suggestedTime())) return true;

            var currentPortions = cm.getPortions().stream()
                .sorted(java.util.Comparator.comparing(p -> idToAbbr.getOrDefault(p.getFoodGroupId(), "")))
                .toList();
            var newPortions = nm.portions().stream()
                .sorted(java.util.Comparator.comparing(MealPortionInput::foodGroupAbbr))
                .toList();

            if (currentPortions.size() != newPortions.size()) return true;
            for (int j = 0; j < currentPortions.size(); j++) {
                String currAbbr = idToAbbr.getOrDefault(currentPortions.get(j).getFoodGroupId(), "");
                if (!currAbbr.equals(newPortions.get(j).foodGroupAbbr())) return true;
                if (currentPortions.get(j).getPortions().compareTo(newPortions.get(j).portions()) != 0) return true;
            }
        }
        return false;
    }

    private void validatePortions(PlanSaveDto dto) {
        for (MealSaveDto meal : dto.meals()) {
            for (MealPortionInput portion : meal.portions()) {
                BigDecimal remainder = portion.portions().remainder(new BigDecimal("0.5"));
                if (remainder.compareTo(BigDecimal.ZERO) != 0) {
                    throw new InvalidPortionsException();
                }
            }
        }
    }

    private PlanDto toDto(Plan plan) {
        List<PlanFoodGroupDto> groups = toGroupDtos(plan.getFoodGroups());
        var meals = plan.getMeals().stream().map(meal -> {
            var portions = meal.getPortions().stream()
                .map(p -> new MealPortionDto(p.getFoodGroupId(), p.getPortions()))
                .toList();
            return new MealDto(meal.getId(), meal.getName(), meal.getSuggestedTime(), meal.getDisplayOrder(), portions);
        }).toList();
        return new PlanDto(groups, meals, plan.getVersion(), plan.getCreatedAt().atZoneSameInstant(clock.getZone()).toLocalDate());
    }

    // ── API pública para módulos externos ─────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PlanFoodGroupDto> getPlanFoodGroups(Long planId) {
        return groupRepository.findByPlanIdOrderByDisplayOrderAsc(planId)
            .stream()
            .map(g -> new PlanFoodGroupDto(g.getId(), g.getName(), g.getAbbreviation(), g.getDisplayOrder(), g.getColor(), g.getClave(), g.isPreguntarSiFalta(), g.isOpcional(), g.getUid()))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<MealPortionSummary> getMealPortions(Long mealId) {
        return mealRepository.findById(mealId)
            .map(meal -> meal.getPortions().stream()
                .map(p -> new MealPortionSummary(p.getFoodGroupId(), p.getPortions()))
                .toList())
            .orElse(List.of());
    }

    @Transactional(readOnly = true)
    public String getModoRegistro(Long planId) {
        return plansRepository.findById(planId)
            .map(Plan::getModoRegistro)
            .orElse("PORCIONES");
    }

    @Transactional(readOnly = true)
    public BigDecimal getMargenPorciones(Long planId) {
        return plansRepository.findById(planId)
            .map(Plan::getMargenPorciones)
            .orElse(new BigDecimal("0.5"));
    }

    @Transactional(readOnly = true)
    public boolean mealBelongsToUser(Long mealId, Long userId) {
        return mealRepository.findByIdAndPlan_UserId(mealId, userId).isPresent();
    }

    @Transactional(readOnly = true)
    public List<Long> getMealIds(Long planId) {
        return mealRepository.findByPlanIdOrderByDisplayOrderAsc(planId)
            .stream().map(Meal::getId).toList();
    }

    @Transactional(readOnly = true)
    public Long findGroupIdByClave(Long planId, String clave) {
        if (clave == null) return null;
        return groupRepository.findByPlanIdAndClave(planId, clave)
            .map(PlanFoodGroup::getId)
            .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<MealRef> getMeals(Long planId) {
        return mealRepository.findByPlanIdOrderByDisplayOrderAsc(planId).stream()
            .map(m -> new MealRef(m.getId(), m.getName())).toList();
    }

    public record MealRef(Long id, String name) {}

    @Transactional(readOnly = true)
    public java.util.Map<LocalDate, PlanReadData> getPlansForRange(Long userId, LocalDate start, LocalDate end) {
        var candidates = plansRepository.findForRange(userId, start, end, clock.getZone().getId());
        var result = new java.util.LinkedHashMap<LocalDate, PlanReadData>();
        var loaded = new java.util.HashMap<Long, PlanReadData>();
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            LocalDate day = date;
            // Mismo orden y extremos inclusivos que findActiveOnDate; el ultimo es el mas antiguo.
            Plan selected = candidates.stream().filter(p -> !p.getCreatedAt().atZoneSameInstant(clock.getZone()).toLocalDate().isAfter(day)
                && (p.getSupersededAt() == null || !p.getSupersededAt().atZoneSameInstant(clock.getZone()).toLocalDate().isBefore(day)))
                .findFirst().orElse(candidates.isEmpty() ? null : candidates.getLast());
            if (selected != null) result.put(date, loaded.computeIfAbsent(selected.getId(), id -> readData(selected)));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public PlanReadData getReadData(Long planId) {
        return readData(plansRepository.findById(planId).orElseThrow(PlanNotFoundException::new));
    }

    private PlanReadData readData(Plan plan) {
        var meals = mealRepository.findWithPortionsByPlanId(plan.getId()).stream()
            .map(m -> new PlanReadData.MealData(m.getId(), m.getName(), m.getPortions().stream()
                .map(p -> new MealPortionSummary(p.getFoodGroupId(), p.getPortions())).toList())).toList();
        return new PlanReadData(plan.getId(), plan.getCreatedAt().atZoneSameInstant(clock.getZone()).toLocalDate(),
            plan.getSupersededAt() == null ? null : plan.getSupersededAt().atZoneSameInstant(clock.getZone()).toLocalDate(),
            plan.getModoRegistro(), plan.getMargenPorciones(), getPlanFoodGroups(plan.getId()), meals);
    }

    // ── privados ──────────────────────────────────────────────────────────────

    private List<PlanFoodGroupDto> toGroupDtos(List<PlanFoodGroup> groups) {
        return groups.stream()
            .map(g -> new PlanFoodGroupDto(g.getId(), g.getName(), g.getAbbreviation(), g.getDisplayOrder(), g.getColor(), g.getClave(), g.isPreguntarSiFalta(), g.isOpcional(), g.getUid()))
            .toList();
    }

    @Transactional(readOnly = true)
    public PlanRef currentPlanRef(Long userId) {
        Plan plan = plansRepository.findByUserIdAndCurrentTrue(userId).orElseThrow(PlanNotFoundException::new);
        return new PlanRef(plan.getId(), plan.getVersion());
    }

    @Transactional
    public void checkAndBumpVersion(Long planId, Long expectedVersion) {
        entityManager.flush();
        int changed = entityManager.createNativeQuery("UPDATE plans SET version = version + 1 WHERE id = :id AND version = :version AND is_current = true")
            .setParameter("id", planId).setParameter("version", expectedVersion).executeUpdate();
        if (changed != 1) throw new PlanVersionConflictException();
        entityManager.refresh(entityManager.find(Plan.class, planId));
    }

    @Transactional
    public Long forkCurrentPlan(Long userId) {
        Plan old = plansRepository.lockCurrentByUserId(userId)
            .or(() -> plansRepository.lockCurrentByUserId(userId))
            .orElseThrow(PlanNotFoundException::new);
        old.setCurrent(false);
        old.setSupersededAt(OffsetDateTime.now());
        plansRepository.flush();
        Plan copy = copyPlan(userId, java.util.Optional.of(old));
        Map<Long, String> abbreviations = old.getFoodGroups().stream()
            .collect(Collectors.toMap(PlanFoodGroup::getId, PlanFoodGroup::getAbbreviation));
        var meals = old.getMeals().stream().map(m -> new MealSaveDto(m.getName(), m.getSuggestedTime(), m.getDisplayOrder(),
            m.getPortions().stream().map(portion -> new MealPortionInput(abbreviations.get(portion.getFoodGroupId()), portion.getPortions())).toList())).toList();
        buildMeals(copy, new PlanSaveDto(meals, null), copy.getFoodGroups().stream()
            .collect(Collectors.toMap(PlanFoodGroup::getAbbreviation, PlanFoodGroup::getId)));
        plansRepository.flush();
        completeVersion(old, copy);
        return copy.getId();
    }

    private void completeVersion(Plan old, Plan copy) {
        entityManager.createNativeQuery("UPDATE plans SET version = :version WHERE id = :id")
            .setParameter("id", copy.getId())
            .setParameter("version", Math.max(copy.getVersion(), old.getVersion()) + 1)
            .executeUpdate();
        entityManager.refresh(copy);
        Map<java.util.UUID, Long> groupsByUid = copy.getFoodGroups().stream()
            .collect(Collectors.toMap(PlanFoodGroup::getUid, PlanFoodGroup::getId));
        Map<Long, Long> groupIdMap = old.getFoodGroups().stream()
            .collect(Collectors.toMap(PlanFoodGroup::getId, g -> groupsByUid.get(g.getUid())));
        // Empareja comidas por nombre; si se renombró, por posición.
        Map<Long, Long> mealIdMap = new java.util.HashMap<>();
        java.util.Set<Long> taken = new java.util.HashSet<>();
        for (Meal source : old.getMeals()) {
            copy.getMeals().stream()
                .filter(m -> m.getName().equals(source.getName()) && !taken.contains(m.getId()))
                .findFirst()
                .ifPresent(m -> { mealIdMap.put(source.getId(), m.getId()); taken.add(m.getId()); });
        }
        for (Meal source : old.getMeals()) {
            if (mealIdMap.containsKey(source.getId())) continue;
            copy.getMeals().stream()
                .filter(m -> m.getDisplayOrder() == source.getDisplayOrder() && !taken.contains(m.getId()))
                .findFirst()
                .ifPresent(m -> { mealIdMap.put(source.getId(), m.getId()); taken.add(m.getId()); });
        }
        events.publishEvent(new PlanVersionCreated(old.getUserId(), old.getId(), copy.getId(),
            Map.copyOf(groupIdMap), Map.copyOf(mealIdMap), LocalDate.now(clock)));
    }

    @Transactional(noRollbackFor = PlanNotFoundException.class)
    public Long lockCurrentPlan(Long userId) {
        return plansRepository.lockCurrentByUserId(userId)
            .or(() -> plansRepository.lockCurrentByUserId(userId))
            .map(Plan::getId)
            .orElseThrow(PlanNotFoundException::new);
    }

    @Transactional
    public void bumpVersion(Long planId) {
        entityManager.flush();
        int changed = entityManager.createNativeQuery("UPDATE plans SET version = version + 1 WHERE id = :id AND is_current = true")
            .setParameter("id", planId)
            .executeUpdate();
        if (changed != 1) {
            throw new PlanVersionConflictException();
        }
        entityManager.refresh(entityManager.find(Plan.class, planId));
    }

    private PlanFoodGroup group(Long planId, java.util.UUID uid) {
        return groupRepository.findByPlanIdOrderByDisplayOrderAsc(planId).stream().filter(g -> g.getUid().equals(uid))
            .findFirst().orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Grupo no encontrado."));
    }

    @Transactional(readOnly = true)
    public Long findGroupIdByUid(Long planId, java.util.UUID uid) { return group(planId, uid).getId(); }

    @Transactional
    public PlanFoodGroupDto createGroup(Long planId, GroupInput in) {
        Plan plan = plansRepository.findById(planId).orElseThrow(PlanNotFoundException::new);
        PlanFoodGroup group = new PlanFoodGroup(plan, in.name(), "", (short)(getPlanFoodGroups(planId).stream().mapToInt(PlanFoodGroupDto::displayOrder).max().orElse(0) + 1));
        applyGroup(group, in, true);
        plan.getFoodGroups().add(group);
        groupRepository.saveAndFlush(group);
        return toGroupDtos(List.of(group)).getFirst();
    }

    @Transactional
    public PlanFoodGroupDto updateGroup(Long planId, java.util.UUID uid, GroupInput in) {
        PlanFoodGroup group = group(planId, uid);
        applyGroup(group, in, false);
        return toGroupDtos(List.of(group)).getFirst();
    }

    private void applyGroup(PlanFoodGroup group, GroupInput in, boolean creating) {
        if (in.name() == null || in.name().isBlank() || in.name().length() > 60) throw new IllegalArgumentException("Nombre o color de grupo inválido.");
        var others = groupRepository.findByPlanIdOrderByDisplayOrderAsc(group.getPlan().getId()).stream()
            .filter(g -> !g.getUid().equals(group.getUid())).toList();
        String abbr = in.abbreviation();
        if (abbr == null || abbr.isBlank()) {
            String base = java.text.Normalizer.normalize(in.name().strip(), java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toUpperCase(java.util.Locale.ROOT);
            base = base.substring(0, Math.min(3, base.length()));
            abbr = base;
            int suffix = 1;
            while (hasAbbreviation(others, abbr)) abbr = base + suffix++;
        }
        if (abbr.length() > 10 || (in.clave() != null && in.clave().length() > 50)) throw new IllegalArgumentException("Abreviatura o clave demasiado larga.");
        if (hasAbbreviation(others, abbr) || (in.clave() != null && others.stream().anyMatch(g -> in.clave().equals(g.getClave())))) throw new DuplicateGroupException();
        group.setName(in.name().strip()); group.setAbbreviation(abbr); group.setClave(in.clave());
        // Al editar sin indicar color, el grupo conserva el suyo.
        String color = !creating && in.color() == null ? group.getColor() : in.color();
        if (creating && !GroupColors.contains(color)) {
            color = GroupColors.next(others.stream().map(PlanFoodGroup::getColor).toList());
        } else if (!creating && !GroupColors.contains(color) && !java.util.Objects.equals(color, group.getColor())) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
                "Elegí un color de la paleta de grupos.");
        }
        group.setColor(color);
        group.setPreguntarSiFalta(in.preguntarSiFalta()); group.setOpcional(in.opcional());
    }

    private boolean hasAbbreviation(List<PlanFoodGroup> groups, String abbreviation) {
        return groups.stream().anyMatch(g -> abbreviation.equals(g.getAbbreviation()));
    }

    @Transactional
    public void reorderGroups(Long planId, List<java.util.UUID> uids) {
        var groups = groupRepository.findByPlanIdOrderByDisplayOrderAsc(planId);
        if (uids == null || uids.size() != groups.size() || new java.util.HashSet<>(uids).size() != groups.size()
            || !new java.util.HashSet<>(uids).equals(groups.stream().map(PlanFoodGroup::getUid).collect(Collectors.toSet())))
            throw new IllegalArgumentException("Indicá todos los grupos del plan una sola vez.");
        for (int i = 0; i < uids.size(); i++) group(planId, uids.get(i)).setDisplayOrder((short)(i + 1));
    }

    @Transactional
    public void deleteGroup(Long planId, java.util.UUID uid) {
        PlanFoodGroup group = group(planId, uid);
        for (Meal meal : mealRepository.findByPlanIdOrderByDisplayOrderAsc(planId)) {
            meal.getPortions().removeIf(portion -> portion.getFoodGroupId().equals(group.getId())
                && portion.getPortions().signum() == 0);
        }
        mealRepository.flush();
        group.getPlan().getFoodGroups().remove(group);
        groupRepository.flush();
    }

    @Transactional(readOnly = true)
    public int countMealPortions(Long planId, Long groupId) {
        return (int)mealRepository.findByPlanIdOrderByDisplayOrderAsc(planId).stream()
            .filter(m -> m.getPortions().stream().anyMatch(portion -> portion.getFoodGroupId().equals(groupId)
                && portion.getPortions().signum() > 0)).count();
    }
}
