package uy.miga.plans;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

interface MealRepository extends JpaRepository<Meal, Long> {
    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT m FROM Meal m LEFT JOIN FETCH m.portions WHERE m.plan.id = :planId ORDER BY m.displayOrder")
    List<Meal> findWithPortionsByPlanId(@org.springframework.data.repository.query.Param("planId") Long planId);

    Optional<Meal> findByIdAndPlan_UserId(Long id, Long userId);
    List<Meal> findByPlanIdOrderByDisplayOrderAsc(Long planId);
}
