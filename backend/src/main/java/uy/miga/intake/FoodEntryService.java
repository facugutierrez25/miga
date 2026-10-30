package uy.miga.intake;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.util.List;

@Service
class FoodEntryService {

    private final FoodEntryRepository repository;

    FoodEntryService(FoodEntryRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    List<FoodEntryDto> getEntriesForDay(String userEmail, LocalDate date) {
        return repository.findByUserEmailAndDateOrderByIdAsc(userEmail, date)
            .stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    FoodEntryDto addEntry(String userEmail, Long mealId, LocalDate date,
                          String food, Double quantity, String unit, Long foodGroupId) {
        FoodEntry entry = new FoodEntry(userEmail, mealId, date, food.strip(), quantity, unit.strip(), foodGroupId);
        return toDto(repository.save(entry));
    }

    @Transactional
    void deleteEntry(String userEmail, Long id) {
        FoodEntry entry = repository.findByIdAndUserEmail(id, userEmail)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        repository.delete(entry);
    }

    @Transactional
    void markConsumed(String userEmail, Long mealId, LocalDate date, boolean consumed) {
        repository.setConsumedByMeal(userEmail, mealId, date, consumed);
    }

    private FoodEntryDto toDto(FoodEntry e) {
        return new FoodEntryDto(e.getId(), e.getMealId(), e.getFood(), e.getQuantity(), e.getUnit(), e.getFoodGroupId(), e.isConsumed());
    }
}
