package uy.miga.users;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;

@Component
public class EmailOutboxWorker {

    private static final Logger log = LoggerFactory.getLogger(EmailOutboxWorker.class);
    private static final int BATCH_SIZE = 10;

    private final EmailOutboxJobRepository outboxRepository;
    private final VerificationTokenRepository tokenRepository;
    private final EmailService emailService;

    EmailOutboxWorker(EmailOutboxJobRepository outboxRepository,
                      VerificationTokenRepository tokenRepository,
                      EmailService emailService) {
        this.outboxRepository = outboxRepository;
        this.tokenRepository = tokenRepository;
        this.emailService = emailService;
    }

    @Scheduled(fixedDelayString = "${app.email-outbox.poll-interval-ms:30000}")
    @Transactional
    public void processJobs() {
        List<EmailOutboxJob> jobs = outboxRepository.findPendingForProcessing(
                OffsetDateTime.now(), Pageable.ofSize(BATCH_SIZE));

        for (EmailOutboxJob job : jobs) {
            processJob(job);
        }

        outboxRepository.deleteOldJobs(OffsetDateTime.now().minusDays(7));
    }

    private void processJob(EmailOutboxJob job) {
        if (!"VERIFY_EMAIL".equals(job.getJobType())) {
            markFailed(job);
            return;
        }
        var tokenOpt = tokenRepository.findByUser_Id(job.getUserId());
        if (tokenOpt.isEmpty() || tokenOpt.get().getExpiresAt().isBefore(OffsetDateTime.now())) {
            markFailed(job);
            return;
        }
        try {
            emailService.sendVerificationEmail(job.getRecipient(), tokenOpt.get().getToken());
            job.setStatus("SENT");
            job.setProcessedAt(OffsetDateTime.now());
        } catch (Exception e) {
            int nextAttempt = job.getAttempts() + 1;
            job.setAttempts(nextAttempt);
            log.warn("Fallo al entregar trabajo de email {} (intento {}): {}",
                    job.getId(), nextAttempt, e.getClass().getSimpleName());
            if (nextAttempt >= job.getMaxAttempts()) {
                markFailed(job);
            } else {
                job.setNextAttemptAt(OffsetDateTime.now().plus(backoffFor(nextAttempt)));
            }
        }
        outboxRepository.save(job);
    }

    private void markFailed(EmailOutboxJob job) {
        job.setStatus("FAILED");
        job.setProcessedAt(OffsetDateTime.now());
    }

    private Duration backoffFor(int attempt) {
        return switch (attempt) {
            case 1 -> Duration.ofMinutes(5);
            case 2 -> Duration.ofMinutes(30);
            default -> Duration.ofHours(1);
        };
    }
}
