package uy.miga.intake;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Component
public class FoodEntryFacade {

    private final FoodEntryRepository repository;

    public FoodEntryFacade(FoodEntryRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public Long createNoteEntry(Long userId, String userEmail, Long mealId, LocalDate date,
                                String food, Double quantity, String unit,
                                Long foodGroupId, Long mealNoteId,
                                String originalText, Boolean uncertain,
                                BigDecimal portions) {
        FoodEntry entry = new FoodEntry(userId, userEmail, mealId, date, food.strip(), quantity, unit.strip(), foodGroupId);
        entry.setMealNoteId(mealNoteId);
        entry.setTextoOriginal(originalText);
        entry.setOrigen("REGLA");
        entry.setSupuesto(uncertain);
        entry.setPorciones(portions);
        return repository.save(entry).getId();
    }

    @Transactional
    public void deleteReglaEntries(Long mealNoteId) {
        repository.deleteByMealNoteIdAndOrigen(mealNoteId, "REGLA");
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
    public void updateEntry(Long id, Double quantity, String unit, Long foodGroupId, BigDecimal portions) {
        repository.findById(id).ifPresent(e -> {
            if (quantity != null) e.setQuantity(quantity);
            if (unit != null) e.setUnit(unit.strip());
            if (foodGroupId != null) e.setFoodGroupId(foodGroupId);
            if (portions != null) e.setPorciones(portions);
            repository.save(e);
        });
    }

    @Transactional
    public Long createUserEntry(Long userId, String userEmail, Long mealId, LocalDate date,
                                String food, Long foodGroupId) {
        FoodEntry entry = new FoodEntry(userId, userEmail, mealId, date, food.strip(), 1.0, "u", foodGroupId);
        entry.setOrigen("USUARIO");
        entry.setPorciones(BigDecimal.ONE);
        return repository.save(entry).getId();
    }

    private EntryData toEntryData(FoodEntry e) {
        return new EntryData(
            e.getId(), e.getMealId(), e.getFood(), e.getQuantity(), e.getUnit(),
            e.getFoodGroupId(), e.isConsumed(), e.getMealNoteId(),
            e.getOrigen(), e.getSupuesto(), e.getPorciones());
    }

    public record EntryData(
        Long id, Long mealId, String food, Double quantity, String unit,
        Long foodGroupId, boolean consumed, Long mealNoteId,
        String origin, Boolean uncertain, BigDecimal portions
    ) {}
}
