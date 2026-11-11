package uy.miga.intake;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import uy.miga.reglas.RuleText;

@Component
public class FoodEntryFacade {
    @Transactional(readOnly = true)
    public boolean hasEntriesForMeals(List<Long> mealIds) { return !mealIds.isEmpty() && repository.existsByMealIdIn(mealIds); }

    private final FoodEntryRepository repository;

    @Transactional
    public void markResolved(List<Long> ids, UUID ruleUid) {
        repository.findAllById(ids).forEach(e -> {
            e.setResolved(true);
            e.setResolvedRuleUid(ruleUid);
            if (EntryOrigin.RULE.equals(e.getOrigin())) e.setOrigin(EntryOrigin.USER);
        });
    }

    public FoodEntryFacade(FoodEntryRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public Long createNoteEntry(Long userId, String userEmail, Long mealId, LocalDate date,
                                String food, Double quantity, String unit,
                                Long foodGroupId, Long mealNoteId,
                                String originalText, Boolean uncertain,
                                BigDecimal portions, String appliedRule, UUID occurrenceId,
                                String ruleType, String ruleSource) {
        String cleanUnit = unit != null ? unit.strip() : null;
        FoodEntry entry = new FoodEntry(userId, userEmail, mealId, date, food.strip(), quantity, cleanUnit, foodGroupId);
        entry.setMealNoteId(mealNoteId);
        entry.setOriginalText(originalText);
        entry.setOrigin(EntryOrigin.RULE);
        entry.setEstimated(uncertain);
        entry.setPortions(portions);
        entry.setAppliedRule(appliedRule);
        entry.setOccurrenceId(occurrenceId);
        entry.setRuleType(ruleType);
        entry.setRuleSource(ruleSource);
        return repository.save(entry).getId();
    }

    @Transactional
    public Long createMentionEntry(Long userId, String userEmail, Long mealId, LocalDate date,
                                   String food, Double quantity, String unit, Long mealNoteId,
                                   String originalText, Boolean uncertain, String appliedRule,
                                   UUID occurrenceId, boolean recognized, String ruleType, String ruleSource) {
        Long id = createNoteEntry(userId, userEmail, mealId, date, food, quantity, unit,
            null, mealNoteId, originalText, uncertain, null, appliedRule, occurrenceId,
            recognized ? ruleType : null, recognized ? ruleSource : null);
        repository.findById(id).orElseThrow().setOrigin(recognized ? EntryOrigin.MENTION : EntryOrigin.UNKNOWN);
        return id;
    }

    // Volver a guardar una nota la reinterpreta entera: se descartan sus ítems,
    // incluidas las correcciones (para conservarlas se guardan como regla).
    @Transactional
    public void deleteNoteEntries(Long mealNoteId) {
        repository.deleteByMealNoteId(mealNoteId);
    }

    @Transactional(readOnly = true)
    public List<EntryData> findByMealNoteId(Long mealNoteId) {
        return repository.findByMealNoteIdOrderByIdAsc(mealNoteId)
            .stream().map(this::toEntryData).toList();
    }

    @Transactional(readOnly = true)
    public List<EntryData> findByUserIdAndDateRange(Long userId, LocalDate start, LocalDate end) {
        return repository.findByUserIdAndDateBetweenOrderByIdAsc(userId, start, end)
            .stream().map(this::toEntryData).toList();
    }

    @Transactional(readOnly = true)
    public List<EntryData> findByUserIdAndDate(Long userId, LocalDate date) {
        return repository.findByUserIdAndDateOrderByIdAsc(userId, date)
            .stream().map(this::toEntryData).toList();
    }

    @Transactional(readOnly = true)
    public List<EntryData> findByUserEmailAndDate(String userEmail, LocalDate date) {
        return repository.findByUserEmailAndDateOrderByIdAsc(userEmail, date)
            .stream().map(this::toEntryData).toList();
    }

    @Transactional(readOnly = true)
    public EntryData findEntryByIdAndUserId(Long id, Long userId) {
        return repository.findByIdAndUserId(id, userId).map(this::toEntryData).orElse(null);
    }

    @Transactional(readOnly = true)
    public EntryData findEntryByIdAndUserEmail(Long id, String userEmail) {
        return repository.findByIdAndUserEmail(id, userEmail).map(this::toEntryData).orElse(null);
    }

    @Transactional
    public void deleteEntries(List<Long> ids) {
        repository.deleteAllById(ids);
        repository.flush();
    }

    @Transactional
    public void correctEntry(Long id, Double quantity, String unit, Long foodGroupId, BigDecimal portions) {
        repository.findById(id).ifPresent(e -> {
            if (quantity != null) e.setQuantity(quantity);
            if (unit != null) e.setUnit(unit.strip());
            if (foodGroupId != null) e.setFoodGroupId(foodGroupId);
            if (portions != null) e.setPortions(portions);
            e.setAppliedRule("Corrección del usuario: " + e.getPortions() + " " + RuleText.portionUnit(e.getPortions()));
            e.setEstimated(false);
            e.setOrigin(EntryOrigin.USER);
            e.setRuleType("NORMAL");
            e.setRuleSource(EntryOrigin.USER);
            repository.save(e);
        });
    }

    @Transactional
    public List<Long> makeFlexible(Long id) {
        FoodEntry entry = repository.findById(id).orElseThrow();
        List<Long> replacedIds = collapseOccurrence(entry);
        entry.setFoodGroupId(null);
        entry.setPortions(null);
        entry.setRuleType("FLEXIBLE");
        entry.setRuleSource(EntryOrigin.USER);
        entry.setOrigin(EntryOrigin.USER);
        entry.setAppliedRule(entry.getFood() + ": cuenta como comida flexible");
        entry.setEstimated(false);
        return replacedIds;
    }

    @Transactional
    public List<Long> collapseOccurrence(Long id) {
        return collapseOccurrence(repository.findById(id).orElseThrow());
    }

    private List<Long> collapseOccurrence(FoodEntry entry) {
        if (entry.getOccurrenceId() == null) {
            if (entry.getMealNoteId() != null
                    && repository.existsByUserIdAndDateAndMealIdAndMealNoteIdAndFoodAndOriginalTextAndOccurrenceIdIsNullAndIdNot(
                        entry.getUserId(), entry.getDate(), entry.getMealId(), entry.getMealNoteId(),
                        entry.getFood(), entry.getOriginalText(), entry.getId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Este alimento se anotó en una versión anterior; editá la nota para corregirlo");
            }
            return List.of(entry.getId());
        }
        var siblings = repository.findByUserIdAndDateAndMealIdAndOccurrenceIdOrderByIdAsc(
            entry.getUserId(), entry.getDate(), entry.getMealId(), entry.getOccurrenceId());
        List<Long> replacedIds = siblings.stream().map(FoodEntry::getId).toList();
        repository.deleteAll(siblings.stream().filter(sibling -> !sibling.getId().equals(entry.getId())).toList());
        return replacedIds;
    }

    // Reemplaza un ítem por uno por grupo, conservando comida, fecha, nota y mención.
    @Transactional
    public List<Long> splitEntry(Long id, Map<Long, BigDecimal> portionsByGroup) {
        FoodEntry source = repository.findById(id).orElseThrow();
        UUID occurrenceId = source.getOccurrenceId() != null ? source.getOccurrenceId() : UUID.randomUUID();
        List<Long> ids = new ArrayList<>();
        portionsByGroup.forEach((groupId, portions) -> {
            FoodEntry entry = new FoodEntry(source.getUserId(), source.getUserEmail(), source.getMealId(),
                source.getDate(), source.getFood(), source.getQuantity(), source.getUnit(), groupId);
            entry.setMealNoteId(source.getMealNoteId());
            entry.setOriginalText(source.getOriginalText());
            entry.setOccurrenceId(occurrenceId);
            entry.setConsumed(source.isConsumed());
            entry.setOrigin(EntryOrigin.USER);
            entry.setRuleType("COMPUESTO");
            entry.setRuleSource(EntryOrigin.USER);
            entry.setEstimated(false);
            entry.setPortions(portions);
            ids.add(repository.save(entry).getId());
        });
        repository.delete(source);
        return ids;
    }

    @Transactional
    public Long createUserEntry(Long userId, String userEmail, Long mealId, LocalDate date,
                                String food, Long foodGroupId) {
        FoodEntry entry = new FoodEntry(userId, userEmail, mealId, date, food.strip(), 1.0, "u", foodGroupId);
        entry.setOrigin(EntryOrigin.USER);
        entry.setRuleSource(EntryOrigin.USER);
        entry.setPortions(BigDecimal.ONE);
        return repository.save(entry).getId();
    }

    @Transactional
    public void createResponseEntry(Long userId, String userEmail, Long mealId, LocalDate date,
                                    String food, Long foodGroupId) {
        if (repository.existsByUserIdAndDateAndMealIdAndFoodGroupIdAndOrigin(
            userId, date, mealId, foodGroupId, EntryOrigin.RESPONSE)) return;
        FoodEntry entry = new FoodEntry(userId, userEmail, mealId, date, food.strip(), 1.0, "u", foodGroupId);
        entry.setOrigin(EntryOrigin.RESPONSE);
        // La respuesta viene de un grupo del plan marcado para preguntar si falta.
        entry.setRuleType("PREGUNTAR");
        entry.setRuleSource("PLAN");
        entry.setPortions(BigDecimal.ONE);
        repository.save(entry);
    }

    @Transactional
    public void deleteResponseEntries(Long userId, LocalDate date, Long mealId, Long foodGroupId) {
        repository.deleteByUserIdAndDateAndMealIdAndFoodGroupIdAndOrigin(
            userId, date, mealId, foodGroupId, EntryOrigin.RESPONSE);
    }

    // Borra todo lo registrado en una comida de un día: ítems de la nota, respuestas y cargas manuales.
    @Transactional
    public void deleteMealEntries(Long userId, LocalDate date, Long mealId) {
        repository.deleteMealEntries(userId, date, mealId);
    }

    @Transactional
    public void detachGroup(Long groupId) {
        repository.findByFoodGroupId(groupId).forEach(entry -> entry.setFoodGroupId(null));
        repository.flush();
    }

    private EntryData toEntryData(FoodEntry e) {
        return new EntryData(
            e.getId(), e.getMealId(), e.getFood(), e.getQuantity(), e.getUnit(),
            e.getFoodGroupId(), e.isConsumed(), e.getMealNoteId(),
            e.getOrigin(), e.getEstimated(), e.getPortions(),
            e.getDate(), e.getOriginalText(), e.getAppliedRule(), e.getOccurrenceId(),
            e.getRuleType(), e.getRuleSource(), e.isResolved(), e.getResolvedRuleUid());
    }

    public record EntryData(
        Long id, Long mealId, String food, Double quantity, String unit,
        Long foodGroupId, boolean consumed, Long mealNoteId,
        String origin, Boolean uncertain, BigDecimal portions,
        LocalDate date, String originalText, String appliedRule, UUID occurrenceId,
        String ruleType, String ruleSource, boolean resolved, UUID resolvedRuleUid
    ) {}
}
