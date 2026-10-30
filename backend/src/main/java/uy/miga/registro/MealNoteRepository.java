package uy.miga.registro;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

interface MealNoteRepository extends JpaRepository<MealNote, Long> {
    Optional<MealNote> findByUserIdAndDateAndMealId(Long userId, LocalDate date, Long mealId);
    List<MealNote> findByUserIdAndDate(Long userId, LocalDate date);
    Optional<MealNote> findByIdAndUserId(Long id, Long userId);
}
