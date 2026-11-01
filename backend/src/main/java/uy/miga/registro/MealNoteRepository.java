package uy.miga.registro;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

interface MealNoteRepository extends JpaRepository<MealNote, Long> {
    @Query(value = "SELECT EXISTS (SELECT 1 FROM meal_notes WHERE plan_id = :planId AND texto ~ '[^[:space:]]')", nativeQuery = true)
    boolean existsByPlanId(@Param("planId") Long planId);

    Optional<MealNote> findByUserIdAndDateAndMealId(Long userId, LocalDate date, Long mealId);
    List<MealNote> findByUserIdAndDateBetween(Long userId, LocalDate start, LocalDate end);
    List<MealNote> findByUserIdAndDate(Long userId, LocalDate date);
    Optional<MealNote> findByIdAndUserId(Long id, Long userId);

    @Query(value = "SELECT texto FROM meal_notes WHERE user_id = :userId AND meal_id = :mealId AND texto ~ '[^[:space:]]' " +
                   "GROUP BY texto ORDER BY COUNT(*) DESC, MIN(id) ASC LIMIT 5",
           nativeQuery = true)
    List<String> findTopTextsByUserIdAndMealId(@Param("userId") Long userId,
                                               @Param("mealId") Long mealId);
}
