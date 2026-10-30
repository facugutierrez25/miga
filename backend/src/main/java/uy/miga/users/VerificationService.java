package uy.miga.users;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
class VerificationService {

    private final VerificationTokenRepository tokenRepository;
    private final UsersRepository usersRepository;
    private final EmailOutboxJobRepository outboxRepository;

    VerificationService(
            VerificationTokenRepository tokenRepository,
            UsersRepository usersRepository,
            EmailOutboxJobRepository outboxRepository) {
        this.tokenRepository = tokenRepository;
        this.usersRepository = usersRepository;
        this.outboxRepository = outboxRepository;
    }

    @Transactional
    void sendVerificationFor(User user) {
        tokenRepository.deleteByUser(user);
        outboxRepository.deleteByUserIdAndJobTypeAndStatus(user.getId(), "VERIFY_EMAIL", "PENDING");

        String token = UUID.randomUUID().toString();
        tokenRepository.save(new VerificationToken(user, token, OffsetDateTime.now().plusHours(24)));
        outboxRepository.save(new EmailOutboxJob(user.getId(), user.getEmail(), "VERIFY_EMAIL"));
    }

    @Transactional
    void verify(String token) {
        VerificationToken vt = tokenRepository.findByToken(token)
                .orElseThrow(InvalidVerificationTokenException::new);
        if (vt.getExpiresAt().isBefore(OffsetDateTime.now())) {
            tokenRepository.delete(vt);
            throw new InvalidVerificationTokenException();
        }
        User user = vt.getUser();
        user.setEmailVerified(true);
        usersRepository.save(user);
        tokenRepository.delete(vt);
    }

    @Transactional
    void resend(String email) {
        usersRepository.findByEmail(email).ifPresent(user -> {
            if (!user.isEmailVerified()) {
                sendVerificationFor(user);
            }
        });
        // Siempre retorna sin error para no revelar si el email existe
    }
}
