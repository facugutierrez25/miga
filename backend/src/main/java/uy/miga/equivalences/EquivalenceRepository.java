package uy.miga.equivalences;

import org.springframework.data.jpa.repository.JpaRepository;
import uy.miga.plans.FoodGroup;

import java.util.List;
import java.util.Optional;

interface EquivalenceRepository extends JpaRepository<Equivalence, Long> {
    List<Equivalence> findByUserEmailOrderByIdAsc(String userEmail);
    Optional<Equivalence> findByIdAndUserEmail(Long id, String userEmail);
}
