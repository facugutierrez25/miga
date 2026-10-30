package uy.miga.users;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import uy.miga.MigaApplication;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = MigaApplication.class, properties = "app.email-outbox.poll-interval-ms=3600000")
@ActiveProfiles("test")
class EmailOutboxWorkerIntegrationTest {

    @Autowired private EmailOutboxWorker worker;
    @Autowired private EmailOutboxJobRepository jobs;
    @Autowired private MockEmailService email;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PlatformTransactionManager transactionManager;

    private final List<Long> users = new ArrayList<>();

    @BeforeEach
    void setup() {
        email.reset();
    }

    @AfterEach
    void cleanup() {
        email.reset();
        for (Long id : users) {
            jdbc.update("DELETE FROM email_outbox WHERE user_id = ?", id);
            jdbc.update("DELETE FROM email_verification_tokens WHERE user_id = ?", id);
            jdbc.update("DELETE FROM users WHERE id = ?", id);
        }
    }

    @Test
    void sendsOutsideTransactionAfterClaimCommitEvenWithTransactionalCaller() {
        var job = createJob();
        email.setOnSend(recipient -> {
            var claimed = reload(job);
            assertThat(claimed.getStatus()).isEqualTo("PROCESSING");
            assertThat(claimed.getLockedUntil()).isAfter(OffsetDateTime.now());
            assertThat(claimed.getProcessedAt()).isNull();
        });

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> worker.processJobs());

        assertThat(email.getTransactionStates()).containsExactly(false);
        assertThat(reload(job).getStatus()).isEqualTo("SENT");
        assertThat(reload(job).getProcessedAt()).isNotNull();
        assertThat(reload(job).getLockedUntil()).isNull();
    }

    @Test
    void failureInSecondJobDoesNotRollbackFirstJob() {
        var first = createJob();
        var second = createJob();
        email.setOnSend(recipient -> {
            if (recipient.equals(second.getRecipient())) {
                throw new IllegalStateException("Provider unavailable");
            }
        });

        worker.processJobs();

        assertThat(email.getRecipients()).containsExactly(first.getRecipient(), second.getRecipient());
        assertThat(email.getTransactionStates()).containsExactly(false, false);
        assertThat(reload(first).getStatus()).isEqualTo("SENT");
        var retry = reload(second);
        assertThat(retry.getStatus()).isEqualTo("PENDING");
        assertThat(retry.getAttempts()).isEqualTo(1);
        assertThat(retry.getNextAttemptAt()).isAfter(OffsetDateTime.now());
        assertThat(retry.getLockedUntil()).isNull();
        assertThat(retry.getProcessedAt()).isNull();
    }

    @Test
    void reclaimsExpiredLeaseAndLeavesActiveLeaseAlone() {
        var expired = createJob();
        var active = createJob();
        expired.setStatus("PROCESSING");
        expired.setLockedUntil(OffsetDateTime.now().minusMinutes(1));
        active.setStatus("PROCESSING");
        active.setLockedUntil(OffsetDateTime.now().plusMinutes(5));
        jobs.saveAllAndFlush(List.of(expired, active));

        worker.processJobs();

        assertThat(email.getRecipients()).containsExactly(expired.getRecipient());
        assertThat(reload(expired).getStatus()).isEqualTo("SENT");
        assertThat(reload(active).getStatus()).isEqualTo("PROCESSING");
    }

    @Test
    void exhaustedAttemptsFailPermanently() {
        var job = createJob();
        job.setAttempts(job.getMaxAttempts() - 1);
        jobs.saveAndFlush(job);
        email.setOnSend(recipient -> { throw new IllegalStateException("Provider unavailable"); });

        worker.processJobs();

        var failed = reload(job);
        assertThat(failed.getStatus()).isEqualTo("FAILED");
        assertThat(failed.getAttempts()).isEqualTo(failed.getMaxAttempts());
        assertThat(failed.getProcessedAt()).isNotNull();
        assertThat(failed.getLockedUntil()).isNull();
    }

    @Test
    void staleWorkerCannotOverwriteNewLease() {
        var job = createJob();
        email.setOnSend(recipient -> jdbc.update(
                "UPDATE email_outbox SET locked_until = now() + interval '10 minutes' WHERE id = ?",
                job.getId()));

        worker.processJobs();

        assertThat(reload(job).getStatus()).isEqualTo("PROCESSING");
        assertThat(reload(job).getProcessedAt()).isNull();
    }

    private EmailOutboxJob createJob() {
        String recipient = UUID.randomUUID() + "@miga.uy";
        Long userId = jdbc.queryForObject("""
                INSERT INTO users (email, password_hash, role) VALUES (?, 'unused', 'PATIENT') RETURNING id
                """, Long.class, recipient);
        users.add(userId);
        jdbc.update("""
                INSERT INTO email_verification_tokens (user_id, token, expires_at)
                VALUES (?, ?, now() + interval '1 day')
                """, userId, UUID.randomUUID().toString());
        return jobs.saveAndFlush(new EmailOutboxJob(userId, recipient, "VERIFY_EMAIL"));
    }

    private EmailOutboxJob reload(EmailOutboxJob job) {
        return jobs.findById(job.getId()).orElseThrow();
    }
}
