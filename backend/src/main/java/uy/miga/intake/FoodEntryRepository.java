package uy.miga.intake;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

interface FoodEntryRepository extends JpaRepository<FoodEntry, Long> {
    boolean existsByMealIdIn(List<Long> mealIds);
    List<FoodEntry> findByUserIdAndDateOrderByIdAsc(Long userId, LocalDate date);
    Optional<FoodEntry> findByIdAndUserId(Long id, Long userId);

    // Legacy queries kept for backward compatibility during transition
    List<FoodEntry> findByUserEmailAndDateOrderByIdAsc(String userEmail, LocalDate date);
    Optional<FoodEntry> findByIdAndUserEmail(Long id, String userEmail);

    @Modifying
    @Query("UPDATE FoodEntry e SET e.consumed = :consumed WHERE e.userId = :userId AND e.mealId = :mealId AND e.date = :date")
    void setConsumedByMeal(@Param("userId") Long userId,
                           @Param("mealId") Long mealId,
                           @Param("date") LocalDate date,
                           @Param("consumed") boolean consumed);

    @Modifying
    @Query("DELETE FROM FoodEntry e WHERE e.mealNoteId = :mealNoteId")
    void deleteByMealNoteId(@Param("mealNoteId") Long mealNoteId);

    List<FoodEntry> findByMealNoteIdOrderByIdAsc(Long mealNoteId);
}
