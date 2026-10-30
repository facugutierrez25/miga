package uy.miga.plans;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

interface PlanFoodGroupRepository extends JpaRepository<PlanFoodGroup, Long> {
    List<PlanFoodGroup> findByPlanIdOrderByDisplayOrderAsc(Long planId);
    Optional<PlanFoodGroup> findByPlanIdAndAbbreviation(Long planId, String abbreviation);
    Optional<PlanFoodGroup> findByPlanIdAndClave(Long planId, String clave);
}
