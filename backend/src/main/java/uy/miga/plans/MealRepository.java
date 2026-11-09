package uy.miga.plans;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface MealRepository extends JpaRepository<Meal, Long> {
    @Query("SELECT DISTINCT m FROM Meal m LEFT JOIN FETCH m.portions WHERE m.plan.id = :planId ORDER BY m.displayOrder")
    List<Meal> findWithPortionsByPlanId(@Param("planId") Long planId);

    @Query("SELECT DISTINCT m FROM Meal m LEFT JOIN FETCH m.portions WHERE m.plan.userId = :userId")
    List<Meal> fetchHistoryPortions(@Param("userId") Long userId);

    Optional<Meal> findByIdAndPlan_UserId(Long id, Long userId);
    List<Meal> findByPlanIdOrderByDisplayOrderAsc(Long planId);
}
