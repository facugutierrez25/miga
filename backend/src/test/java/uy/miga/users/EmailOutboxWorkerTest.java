package uy.miga.users;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class EmailOutboxWorkerTest {

    private final EmailOutboxJobRepository jobs = mock(EmailOutboxJobRepository.class);
    private final VerificationTokenRepository tokens = mock(VerificationTokenRepository.class);
    private final EmailService email = mock(EmailService.class);
    private final RecordingTransactionManager transactions = new RecordingTransactionManager();
    private final EmailOutboxWorker worker = new EmailOutboxWorker(jobs, tokens, email, transactions, 300000);

    @BeforeEach
    void setup() {
        when(tokens.findByUser_Id(any())).thenReturn(Optional.of(
                new VerificationToken(null, "token", OffsetDateTime.now().plusDays(1))));
    }

    @Test
    void sendsAfterClaimCommitAndPersistsEachResultInItsOwnTransaction() {
        var first = job(1L);
        var second = job(2L);
        when(jobs.findPendingForProcessing(any(), any())).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            return List.of(first, second);
        });
        doAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            assertThat(transactions.commits).isGreaterThanOrEqualTo(1);
            assertThat(first.getStatus()).isEqualTo("PROCESSING");
            assertThat(first.getLockedUntil()).isAfter(OffsetDateTime.now());
            return null;
        }).when(email).sendVerificationEmail(first.getRecipient(), "token");
        doThrow(new IllegalStateException()).when(email).sendVerificationEmail(second.getRecipient(), "token");
        when(jobs.findByIdForUpdate(any())).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            return Optional.of(invocation.getArgument(0).equals(1L) ? first : second);
        });
        when(jobs.deleteOldJobs(any())).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            return 0;
        });

        worker.processJobs();

        assertThat(first.getStatus()).isEqualTo("SENT");
        assertThat(first.getProcessedAt()).isNotNull();
        assertThat(second.getStatus()).isEqualTo("PENDING");
        assertThat(second.getAttempts()).isEqualTo(1);
        assertThat(second.getLockedUntil()).isNull();
        assertThat(transactions.commits).isEqualTo(6);
        assertThat(transactions.rollbacks).isZero();
    }

    @Test
    void persistenceFailureDoesNotPreventNextJobOrCleanup() {
        var first = job(1L);
        var second = job(2L);
        when(jobs.findPendingForProcessing(any(), any())).thenReturn(List.of(first, second));
        when(jobs.findByIdForUpdate(1L)).thenThrow(new IllegalStateException());
        when(jobs.findByIdForUpdate(2L)).thenReturn(Optional.of(second));

        worker.processJobs();

        verify(email).sendVerificationEmail(second.getRecipient(), "token");
        assertThat(second.getStatus()).isEqualTo("SENT");
        verify(jobs).deleteOldJobs(any());
        assertThat(transactions.rollbacks).isEqualTo(1);
    }

    @ParameterizedTest
    @CsvSource({"0,5,PENDING", "1,30,PENDING", "2,0,FAILED"})
    void retriesWithBackoffUntilAttemptsAreExhausted(int attempts, long minutes, String expectedStatus) {
        var job = job(1L);
        job.setAttempts(attempts);
        when(jobs.findPendingForProcessing(any(), any())).thenReturn(List.of(job));
        when(jobs.findByIdForUpdate(1L)).thenReturn(Optional.of(job));
        doThrow(new IllegalStateException()).when(email).sendVerificationEmail(any(), any());
        var before = OffsetDateTime.now();

        worker.processJobs();

        assertThat(job.getStatus()).isEqualTo(expectedStatus);
        assertThat(job.getAttempts()).isEqualTo(attempts + 1);
        assertThat(job.getLockedUntil()).isNull();
        if (minutes > 0) {
            assertThat(job.getNextAttemptAt()).isBetween(before.plusMinutes(minutes),
                    OffsetDateTime.now().plusMinutes(minutes));
        } else {
            assertThat(job.getProcessedAt()).isNotNull();
        }
    }

    @Test
    void missingTokenFailsWithoutSending() {
        var job = job(1L);
        when(jobs.findPendingForProcessing(any(), any())).thenReturn(List.of(job));
        when(jobs.findByIdForUpdate(1L)).thenReturn(Optional.of(job));
        when(tokens.findByUser_Id(any())).thenReturn(Optional.empty());

        worker.processJobs();

        assertThat(job.getStatus()).isEqualTo("FAILED");
        assertThat(job.getProcessedAt()).isNotNull();
        assertThat(job.getLockedUntil()).isNull();
        verifyNoInteractions(email);
    }

    @Test
    void resultFromPreviousLeaseCannotOverwriteNewClaim() {
        var claimed = job(1L);
        var current = job(1L);
        current.setStatus("PROCESSING");
        current.setLockedUntil(OffsetDateTime.now().plusMinutes(10));
        when(jobs.findPendingForProcessing(any(), any())).thenReturn(List.of(claimed));
        when(jobs.findByIdForUpdate(1L)).thenReturn(Optional.of(current));

        worker.processJobs();

        assertThat(current.getStatus()).isEqualTo("PROCESSING");
        assertThat(current.getLockedUntil()).isNotNull();
        assertThat(current.getProcessedAt()).isNull();
    }

    private EmailOutboxJob job(Long id) {
        var job = new EmailOutboxJob(id, id + "@miga.uy", "VERIFY_EMAIL");
        ReflectionTestUtils.setField(job, "id", id);
        return job;
    }

    private static class RecordingTransactionManager extends AbstractPlatformTransactionManager {
        private int commits;
        private int rollbacks;

        @Override
        protected Object doGetTransaction() { return new Object(); }
        @Override
        protected void doBegin(Object transaction, TransactionDefinition definition) {}
        @Override
        protected void doCommit(DefaultTransactionStatus status) { commits++; }
        @Override
        protected void doRollback(DefaultTransactionStatus status) { rollbacks++; }
    }
}
