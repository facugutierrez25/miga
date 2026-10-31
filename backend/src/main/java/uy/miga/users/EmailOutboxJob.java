package uy.miga.users;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "email_outbox")
class EmailOutboxJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 320)
    private String recipient;

    @Column(name = "job_type", nullable = false, length = 50)
    private String jobType = "VERIFY_EMAIL";

    @Column(nullable = false, length = 20)
    private String status = "PENDING";

    @Column(nullable = false)
    private int attempts = 0;

    @Column(name = "max_attempts", nullable = false)
    private int maxAttempts = 3;

    @Column(name = "next_attempt_at", nullable = false)
    private OffsetDateTime nextAttemptAt = OffsetDateTime.now();

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "processed_at")
    private OffsetDateTime processedAt;

    @Column(name = "locked_until")
    private OffsetDateTime lockedUntil;

    @Column(name = "token_id")
    private Long tokenId;

    EmailOutboxJob() {}

    EmailOutboxJob(Long userId, String recipient, String jobType, Long tokenId) {
        this.userId = userId;
        this.recipient = recipient;
        this.jobType = jobType;
        this.tokenId = tokenId;
    }

    Long getId() { return id; }
    Long getUserId() { return userId; }
    String getRecipient() { return recipient; }
    String getJobType() { return jobType; }
    String getStatus() { return status; }
    int getAttempts() { return attempts; }
    int getMaxAttempts() { return maxAttempts; }
    OffsetDateTime getNextAttemptAt() { return nextAttemptAt; }
    OffsetDateTime getLockedUntil() { return lockedUntil; }
    Long getTokenId() { return tokenId; }
    OffsetDateTime getProcessedAt() { return processedAt; }

    void setStatus(String status) { this.status = status; }
    void setAttempts(int attempts) { this.attempts = attempts; }
    void setNextAttemptAt(OffsetDateTime nextAttemptAt) { this.nextAttemptAt = nextAttemptAt; }
    void setProcessedAt(OffsetDateTime processedAt) { this.processedAt = processedAt; }
    void setLockedUntil(OffsetDateTime lockedUntil) { this.lockedUntil = lockedUntil; }
}
