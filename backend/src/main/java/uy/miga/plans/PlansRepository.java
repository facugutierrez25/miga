package uy.miga.plans;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

interface PlansRepository extends JpaRepository<Plan, Long> {
    Optional<Plan> findByUserIdAndCurrentTrue(Long userId);
    List<Plan> findAllByUserIdAndCurrentFalseOrderBySupersededAtDesc(Long userId);
}
