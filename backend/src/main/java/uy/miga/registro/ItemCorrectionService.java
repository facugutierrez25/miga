package uy.miga.registro;

import uy.miga.intake.EntryOrigin;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uy.miga.intake.FoodEntryFacade;
import uy.miga.plans.PlanService;
import uy.miga.reglas.ReglaService;
import uy.miga.reglas.Componente;
import uy.miga.reglas.RuleInput;
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
    private final ReglaService ruleService;
    private final UserService userService;
    private final RegistroSupport support;
    private final DayReadService dayReadService;

    ItemCorrectionService(MealNoteRepository noteRepository, FoodEntryFacade entryFacade, PlanService planService,
            ReglaService ruleService, UserService userService, RegistroSupport support, DayReadService dayReadService) {
        this.noteRepository = noteRepository;
        this.entryFacade = entryFacade;
        this.planService = planService;
        this.ruleService = ruleService;
        this.userService = userService;
        this.support = support;
        this.dayReadService = dayReadService;
    }

    @Transactional
    DayRegistroDto.MealDayDto removeItem(String userEmail, LocalDate date, Long entryId, Long version) {
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
        return dayReadService.getDayRegistro(userEmail, date).meals().stream()
            .filter(m -> m.mealId().equals(entry.mealId())).findFirst().orElseThrow();
    }

    @Transactional
    PatchItemResultDto patchItem(String userEmail, LocalDate date, Long entryId, PatchItemRequest req) {
        Long userId = userService.findUserIdByEmail(userEmail);
        Long currentPlanId = support.lockCurrentPlanIfPresent(userId);
        FoodEntryFacade.EntryData entry = entryFacade.findEntryByIdAndUserId(entryId, userId);
        if (entry == null || !entry.date().equals(date)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (Set.of(EntryOrigin.MENTION, EntryOrigin.UNKNOWN).contains(entry.origin() == null ? "" : entry.origin())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Esta mención no admite correcciones.");
        }
        if (req.grupos() != null && (req.foodGroupId() != null || req.portions() != null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Indicá un grupo o varios grupos, no ambos.");
        }

        Long planId = support.entryPlanId(userId, entry);
        if (!planService.getMealIds(planId).contains(entry.mealId())) {
            throw new PlanVersionConflictException();
        }
        if (req.savesRule() && !planId.equals(currentPlanId)) {
            throw new PlanVersionConflictException();
        }
        validateCorrectionGroups(planId, req);

        List<Long> resultIds = applyCorrection(userId, planId, entryId, entry, req);

        if (req.savesRule()) {
            planService.bumpVersion(planId);
        }
        List<DayRegistroDto.EntryItemDto> items = resultIds.stream()
            .map(id -> support.toEntryItemDto(entryFacade.findEntryByIdAndUserId(id, userId)))
            .toList();
        return new PatchItemResultDto(List.of(entryId), items);
    }

    // Al cambiar solo la cantidad, las porciones se ajustan en la misma proporción.
    private BigDecimal scaledPortions(FoodEntryFacade.EntryData entry, BigDecimal quantity) {
        if (entry.portions() == null || entry.quantity() == null || entry.quantity() <= 0) return entry.portions();
        return entry.portions().multiply(quantity)
            .divide(BigDecimal.valueOf(entry.quantity()), 3, RoundingMode.HALF_UP);
    }

    @Transactional
    void saveRespuesta(String userEmail, LocalDate date, Long mealId, RespuestaRequest req) {
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
                // Los componentes quedan por unidad de lo anotado: "200 g" guarda lo de 1 g.
                ruleService.upsertUserRule(userId, planId, new RuleInput(entry.food(), List.of(), "COMPUESTO",
                    null, entry.unit() != null ? BigDecimal.ONE : null, entry.unit(), BigDecimal.ONE, components, null));
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
                    BigDecimal.ONE, List.of(), null));
            }
        }

        return resultIds;
    }

    private void validateCorrectionGroups(Long planId, PatchItemRequest req) {
        Set<Long> planGroups = planService.getPlanFoodGroups(planId).stream()
            .map(PlanFoodGroupDto::id).collect(Collectors.toSet());
        List<Long> requestedGroups = req.grupos() != null
            ? req.grupos().stream().map(PatchItemRequest.GroupPortion::foodGroupId).toList()
            : (req.foodGroupId() != null ? List.of(req.foodGroupId()) : List.of());
        if (!planGroups.containsAll(requestedGroups)
            || new HashSet<>(requestedGroups).size() != requestedGroups.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Los grupos no pertenecen a tu plan.");
        }
    }
}
