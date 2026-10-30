package uy.miga.plans;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

interface MealRepository extends JpaRepository<Meal, Long> {
    Optional<Meal> findByIdAndPlan_UserId(Long id, Long userId);
}
