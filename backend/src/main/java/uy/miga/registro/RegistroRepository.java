package uy.miga.registro;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

interface RegistroRepository extends JpaRepository<MealLog, Long> {
    List<MealLog> findByUserIdAndLoggedDate(Long userId, LocalDate date);
    boolean existsByUserIdAndMealIdAndLoggedDate(Long userId, Long mealId, LocalDate date);
    void deleteByUserIdAndMealIdAndLoggedDate(Long userId, Long mealId, LocalDate date);
}
