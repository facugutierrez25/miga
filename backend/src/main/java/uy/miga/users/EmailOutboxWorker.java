package uy.miga.users;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Component
public class EmailOutboxWorker {

    private static final Logger log = LoggerFactory.getLogger(EmailOutboxWorker.class);
    private static final int BATCH_SIZE = 10;

    private final EmailOutboxJobRepository outboxRepository;
    private final VerificationTokenRepository tokenRepository;
    private final EmailService emailService;
    private final TransactionTemplate transactions;
    private final Duration lease;
    private final Counter sentCounter;
    private final Counter retriedCounter;
    private final Counter failedCounter;
    @Value("${app.email-outbox.scheduler-enabled:true}")
    private boolean schedulerEnabled = true;

    EmailOutboxWorker(EmailOutboxJobRepository outboxRepository,
                      VerificationTokenRepository tokenRepository,
                      EmailService emailService,
                      PlatformTransactionManager transactionManager,
                      MeterRegistry meterRegistry,
                      @Value("${app.email-outbox.lease-ms:300000}") long leaseMs) {
        this.outboxRepository = outboxRepository;
        this.tokenRepository = tokenRepository;
        this.emailService = emailService;
        if (leaseMs <= 0) {
            throw new IllegalArgumentException("Outbox lease must be positive");
        }
        this.lease = Duration.ofMillis(leaseMs);
        this.transactions = new TransactionTemplate(transactionManager);
        this.transactions.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        // Métricas sin datos personales: solo cantidades por resultado y trabajos pendientes.
        this.sentCounter = meterRegistry.counter("email.outbox.jobs", "result", "sent");
        this.retriedCounter = meterRegistry.counter("email.outbox.jobs", "result", "retried");
        this.failedCounter = meterRegistry.counter("email.outbox.jobs", "result", "failed");
        Gauge.builder("email.outbox.pending", outboxRepository,
                repository -> repository.countByStatusIn(List.of("PENDING", "PROCESSING")))
            .register(meterRegistry);
    }

    // En los tests se desactiva: cada contexto de Spring tendría su propio procesador programado
    // leyendo la misma base, y podría tomar el email que espera otro test.
    @Scheduled(fixedDelayString = "${app.email-outbox.poll-interval-ms:30000}")
    void scheduledRun() {
        if (schedulerEnabled) processJobs();
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void processJobs() {
        List<EmailOutboxJob> jobs = transactions.execute(status -> {
            var now = OffsetDateTime.now().truncatedTo(ChronoUnit.MICROS);
            var claimed = outboxRepository.findPendingForProcessing(now, Pageable.ofSize(BATCH_SIZE));
            for (var job : claimed) {
                job.setStatus("PROCESSING");
                job.setLockedUntil(now.plus(lease));
            }
            return claimed;
        });

        for (EmailOutboxJob job : jobs) {
            try {
                processJob(job);
            } catch (Exception e) {
                log.warn("Fallo al procesar trabajo de email {}: {}",
                        job.getId(), e.getClass().getSimpleName());
            }
        }

        transactions.executeWithoutResult(status ->
                outboxRepository.deleteOldJobs(OffsetDateTime.now().minusDays(7)));
    }

    private void processJob(EmailOutboxJob job) {
        // Solo se envía el token con el que se creó el trabajo: si hubo un reenvío, este
        // trabajo quedó obsoleto y el token vigente lo envía su propio trabajo.
        String token = "VERIFY_EMAIL".equals(job.getJobType())
                ? transactions.execute(status -> tokenRepository.findByUser_Id(job.getUserId())
                    .filter(value -> value.getExpiresAt().isAfter(OffsetDateTime.now()))
                    .filter(value -> job.getTokenId() == null || job.getTokenId().equals(value.getId()))
                    .map(VerificationToken::getToken).orElse(null))
                : null;
        if (token == null) {
            recordResult(job, false, true);
            return;
        }

        boolean sent = false;
        try {
            emailService.sendVerificationEmail(job.getRecipient(), token);
            sent = true;
        } catch (Exception e) {
            log.warn("Fallo al entregar trabajo de email {}: {}",
                    job.getId(), e.getClass().getSimpleName());
        }
        recordResult(job, sent, false);
    }

    private void recordResult(EmailOutboxJob claimed, boolean sent, boolean invalid) {
        transactions.executeWithoutResult(status -> {
            var current = outboxRepository.findByIdForUpdate(claimed.getId());
            if (current.isEmpty()) {
                return;
            }
            var job = current.get();
            // Un worker atrasado no debe sobrescribir el resultado de un reclamo posterior.
            if (!"PROCESSING".equals(job.getStatus()) || job.getLockedUntil() == null
                    || !job.getLockedUntil().isEqual(claimed.getLockedUntil())) {
                return;
            }
            job.setLockedUntil(null);
            if (sent) {
                job.setStatus("SENT");
                job.setProcessedAt(OffsetDateTime.now());
                sentCounter.increment();
            } else if (invalid) {
                markFailed(job);
            } else {
                int nextAttempt = job.getAttempts() + 1;
                job.setAttempts(nextAttempt);
                if (nextAttempt >= job.getMaxAttempts()) {
                    markFailed(job);
                } else {
                    job.setStatus("PENDING");
                    job.setNextAttemptAt(OffsetDateTime.now().plus(backoffFor(nextAttempt)));
                    retriedCounter.increment();
                }
            }
        });
    }

    private void markFailed(EmailOutboxJob job) {
        job.setStatus("FAILED");
        job.setProcessedAt(OffsetDateTime.now());
        failedCounter.increment();
    }

    private Duration backoffFor(int attempt) {
        return switch (attempt) {
            case 1 -> Duration.ofMinutes(5);
            case 2 -> Duration.ofMinutes(30);
            default -> Duration.ofHours(1);
        };
    }
}
