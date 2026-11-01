package uy.miga.plans;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

interface PlansRepository extends JpaRepository<Plan, Long> {
    @Query(value = """
        SELECT * FROM plans p WHERE user_id = :userId AND (
          ((created_at AT TIME ZONE :zone)::date <= :end
           AND (superseded_at IS NULL OR (superseded_at AT TIME ZONE :zone)::date >= :start))
          OR id = (SELECT id FROM plans WHERE user_id = :userId ORDER BY created_at, id LIMIT 1))
        ORDER BY created_at DESC, id DESC
        """, nativeQuery = true)
    List<Plan> findForRange(@Param("userId") Long userId, @Param("start") LocalDate start,
                            @Param("end") LocalDate end, @Param("zone") String zone);

    Optional<Plan> findByUserIdAndCurrentTrue(Long userId);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Plan p WHERE p.userId = :userId AND p.current = true")
    Optional<Plan> lockCurrentByUserId(@Param("userId") Long userId);

    List<Plan> findTop50ByUserIdAndCurrentFalseOrderBySupersededAtDescIdDesc(Long userId);

    @Query(value = """
        SELECT * FROM plans
        WHERE user_id = :userId
          AND (created_at AT TIME ZONE :zone)::date <= :date
          AND (superseded_at IS NULL OR (superseded_at AT TIME ZONE :zone)::date >= :date)
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        """, nativeQuery = true)
    Optional<Plan> findActiveOnDate(@Param("userId") Long userId, @Param("date") LocalDate date, @Param("zone") String zone);

    @Query(value = "SELECT * FROM plans WHERE user_id = :userId ORDER BY created_at ASC, id ASC LIMIT 1",
           nativeQuery = true)
    Optional<Plan> findOldestByUserId(@Param("userId") Long userId);
}
