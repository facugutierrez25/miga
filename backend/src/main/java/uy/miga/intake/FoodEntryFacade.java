package uy.miga.intake;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class FoodEntryFacade {
    @Transactional(readOnly = true)
    public boolean hasEntriesForMeals(List<Long> mealIds) { return !mealIds.isEmpty() && repository.existsByMealIdIn(mealIds); }

    private final FoodEntryRepository repository;

    public FoodEntryFacade(FoodEntryRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public Long createNoteEntry(Long userId, String userEmail, Long mealId, LocalDate date,
                                String food, Double quantity, String unit,
                                Long foodGroupId, Long mealNoteId,
                                String originalText, Boolean uncertain,
                                BigDecimal portions, String appliedRule, UUID occurrenceId) {
        FoodEntry entry = new FoodEntry(userId, userEmail, mealId, date, food.strip(), quantity, unit.strip(), foodGroupId);
        entry.setMealNoteId(mealNoteId);
        entry.setTextoOriginal(originalText);
        entry.setOrigen("REGLA");
        entry.setSupuesto(uncertain);
        entry.setPorciones(portions);
        entry.setAppliedRule(appliedRule);
        entry.setOccurrenceId(occurrenceId);
        return repository.save(entry).getId();
    }

    @Transactional
    public Long createMentionEntry(Long userId, String userEmail, Long mealId, LocalDate date,
                                   String food, Double quantity, String unit, Long mealNoteId,
                                   String originalText, Boolean uncertain, String appliedRule,
                                   UUID occurrenceId, boolean recognized) {
        Long id = createNoteEntry(userId, userEmail, mealId, date, food, quantity, unit,
            null, mealNoteId, originalText, uncertain, null, appliedRule, occurrenceId);
        repository.findById(id).orElseThrow().setOrigen(recognized ? "MENTION" : "UNKNOWN");
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
    public void correctEntry(Long id, Double quantity, String unit, Long foodGroupId, BigDecimal portions) {
        repository.findById(id).ifPresent(e -> {
            if (quantity != null) e.setQuantity(quantity);
            if (unit != null) e.setUnit(unit.strip());
            if (foodGroupId != null) e.setFoodGroupId(foodGroupId);
            if (portions != null) e.setPorciones(portions);
            e.setOrigen("USUARIO");
            repository.save(e);
        });
    }

    // Reemplaza un ítem por uno por grupo, conservando comida, fecha, nota y mención.
    @Transactional
    public List<Long> splitEntry(Long id, Map<Long, BigDecimal> portionsByGroup) {
        FoodEntry source = repository.findById(id).orElseThrow();
        List<Long> ids = new ArrayList<>();
        portionsByGroup.forEach((groupId, portions) -> {
            FoodEntry entry = new FoodEntry(source.getUserId(), source.getUserEmail(), source.getMealId(),
                source.getDate(), source.getFood(), source.getQuantity(), source.getUnit(), groupId);
            entry.setMealNoteId(source.getMealNoteId());
            entry.setTextoOriginal(source.getTextoOriginal());
            entry.setOccurrenceId(source.getOccurrenceId());
            entry.setConsumed(source.isConsumed());
            entry.setOrigen("USUARIO");
            entry.setSupuesto(false);
            entry.setPorciones(portions);
            ids.add(repository.save(entry).getId());
        });
        repository.delete(source);
        return ids;
    }

    @Transactional
    public Long createUserEntry(Long userId, String userEmail, Long mealId, LocalDate date,
                                String food, Long foodGroupId) {
        FoodEntry entry = new FoodEntry(userId, userEmail, mealId, date, food.strip(), 1.0, "u", foodGroupId);
        entry.setOrigen("USUARIO");
        entry.setPorciones(BigDecimal.ONE);
        return repository.save(entry).getId();
    }

    @Transactional
    public void createResponseEntry(Long userId, String userEmail, Long mealId, LocalDate date,
                                    String food, Long foodGroupId) {
        if (repository.existsByUserIdAndDateAndMealIdAndFoodGroupIdAndOrigen(
            userId, date, mealId, foodGroupId, "RESPUESTA")) return;
        FoodEntry entry = new FoodEntry(userId, userEmail, mealId, date, food.strip(), 1.0, "u", foodGroupId);
        entry.setOrigen("RESPUESTA");
        entry.setPorciones(BigDecimal.ONE);
        repository.save(entry);
    }

    @Transactional
    public void deleteResponseEntries(Long userId, LocalDate date, Long mealId, Long foodGroupId) {
        repository.deleteByUserIdAndDateAndMealIdAndFoodGroupIdAndOrigen(
            userId, date, mealId, foodGroupId, "RESPUESTA");
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
            e.getOrigen(), e.getSupuesto(), e.getPorciones(),
            e.getDate(), e.getTextoOriginal(), e.getAppliedRule(), e.getOccurrenceId());
    }

    public record EntryData(
        Long id, Long mealId, String food, Double quantity, String unit,
        Long foodGroupId, boolean consumed, Long mealNoteId,
        String origin, Boolean uncertain, BigDecimal portions,
        LocalDate date, String originalText, String appliedRule, UUID occurrenceId
    ) {}
}
