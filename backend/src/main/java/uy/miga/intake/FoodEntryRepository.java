package uy.miga.intake;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

interface FoodEntryRepository extends JpaRepository<FoodEntry, Long> {
    List<FoodEntry> findByUserEmailAndDateOrderByIdAsc(String userEmail, LocalDate date);
    Optional<FoodEntry> findByIdAndUserEmail(Long id, String userEmail);

    @Modifying
    @Query("UPDATE FoodEntry e SET e.consumed = :consumed WHERE e.userEmail = :userEmail AND e.mealId = :mealId AND e.date = :date")
    void setConsumedByMeal(@Param("userEmail") String userEmail,
                           @Param("mealId") Long mealId,
                           @Param("date") LocalDate date,
                           @Param("consumed") boolean consumed);
}
