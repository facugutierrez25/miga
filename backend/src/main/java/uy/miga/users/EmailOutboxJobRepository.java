package uy.miga.users;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.QueryHint;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

interface EmailOutboxJobRepository extends JpaRepository<EmailOutboxJob, Long> {

    @Query("""
            SELECT j FROM EmailOutboxJob j
            WHERE (j.status = 'PENDING' AND j.nextAttemptAt <= :now)
               OR (j.status = 'PROCESSING' AND j.lockedUntil <= :now)
            ORDER BY j.nextAttemptAt, j.id
            """)
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
    List<EmailOutboxJob> findPendingForProcessing(@Param("now") OffsetDateTime now, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT j FROM EmailOutboxJob j WHERE j.id = :id")
    Optional<EmailOutboxJob> findByIdForUpdate(@Param("id") Long id);

    void deleteByUserIdAndJobTypeAndStatus(Long userId, String jobType, String status);

    @Query("DELETE FROM EmailOutboxJob j WHERE j.status IN ('SENT', 'FAILED') AND j.processedAt < :cutoff")
    @org.springframework.data.jpa.repository.Modifying
    int deleteOldJobs(@Param("cutoff") OffsetDateTime cutoff);
}
