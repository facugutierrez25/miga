package uy.miga.equivalences;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
    EquivalenceDto addEquivalence(String userEmail, Long planId, Long foodGroupId,
                                  String food, Double quantity, Unit unit) {
        Equivalence eq = new Equivalence(userEmail, planId, foodGroupId, food.strip(), quantity, unit);
        return toDto(repository.save(eq));
    }

    @Transactional
    void deleteEquivalence(String userEmail, Long id) {
        Equivalence eq = repository.findByIdAndUserEmail(id, userEmail)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        repository.delete(eq);
    }

    private EquivalenceDto toDto(Equivalence eq) {
        return new EquivalenceDto(eq.getId(), eq.getFoodGroupId(), eq.getFood(), eq.getQuantity(), eq.getUnit());
    }
}
