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
    public Long createNoteEntry(String userEmail, Long mealId, LocalDate date,
                                String food, Double quantity, String unit,
                                Long foodGroupId, Long mealNoteId,
                                String textoOriginal, Boolean supuesto,
                                BigDecimal porciones) {
        FoodEntry entry = new FoodEntry(userEmail, mealId, date, food.strip(), quantity, unit.strip(), foodGroupId);
        entry.setMealNoteId(mealNoteId);
        entry.setTextoOriginal(textoOriginal);
        entry.setOrigen("REGLA");
        entry.setSupuesto(supuesto);
        entry.setPorciones(porciones);
        return repository.save(entry).getId();
    }

    @Transactional
    public void deleteReglaEntries(Long mealNoteId) {
        repository.deleteByMealNoteIdAndOrigen(mealNoteId, "REGLA");
    }

    @Transactional(readOnly = true)
    public List<EntryData> findByUserEmailAndDate(String userEmail, LocalDate date) {
        return repository.findByUserEmailAndDateOrderByIdAsc(userEmail, date)
            .stream()
            .map(e -> new EntryData(
                e.getId(), e.getMealId(), e.getFood(), e.getQuantity(), e.getUnit(),
                e.getFoodGroupId(), e.isConsumed(), e.getMealNoteId(),
                e.getOrigen(), e.getSupuesto(), e.getPorciones()))
            .toList();
    }

    public record EntryData(
        Long id, Long mealId, String food, Double quantity, String unit,
        Long foodGroupId, boolean consumed, Long mealNoteId,
        String origen, Boolean supuesto, BigDecimal porciones
    ) {}
}
