package uy.miga.equivalences;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uy.miga.plans.FoodGroup;

import java.util.List;

@Service
class EquivalenceService {

    private final EquivalenceRepository repository;

    EquivalenceService(EquivalenceRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    List<EquivalenceDto> getEquivalences(String userEmail) {
        return repository.findByUserEmailOrderByIdAsc(userEmail)
            .stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    EquivalenceDto addEquivalence(String userEmail, FoodGroup foodGroup, String food, Double quantity, Unit unit) {
        Equivalence eq = new Equivalence(userEmail, foodGroup, food.strip(), quantity, unit);
        return toDto(repository.save(eq));
    }

    @Transactional
    void deleteEquivalence(String userEmail, Long id) {
        Equivalence eq = repository.findByIdAndUserEmail(id, userEmail)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        repository.delete(eq);
    }

    private EquivalenceDto toDto(Equivalence eq) {
        return new EquivalenceDto(eq.getId(), eq.getFoodGroup(), eq.getFood(), eq.getQuantity(), eq.getUnit());
    }
}
