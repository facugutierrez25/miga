package uy.miga.habitos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

interface HabitLogRepository extends JpaRepository<HabitLog, Long> {

    Optional<HabitLog> findByUserIdAndPlanHabitIdAndLogDate(Long userId, Long planHabitId, LocalDate logDate);

    @Query("SELECT l FROM HabitLog l WHERE l.userId = :userId AND l.logDate BETWEEN :from AND :to")
    List<HabitLog> findByUserIdAndDateRange(Long userId, LocalDate from, LocalDate to);
}
