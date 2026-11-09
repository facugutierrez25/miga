package uy.miga.users;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UsersRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final VerificationService verificationService;
    private final ApplicationEventPublisher events;
    private final JdbcTemplate jdbc;

    UserService(UsersRepository repository, PasswordEncoder passwordEncoder,
                VerificationService verificationService,
                ApplicationEventPublisher events, JdbcTemplate jdbc) {
        this.events = events;
        this.jdbc = jdbc;
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.verificationService = verificationService;
    }

    User authenticate(String email, String password) {
        User user = repository.findByEmail(email)
            .orElseThrow(InvalidCredentialsException::new);
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }
        if (!user.isEmailVerified()) {
            throw new EmailNotVerifiedException();
        }
        return user;
    }

    public Long findUserIdByEmail(String email) {
        return repository.findByEmail(email)
            .map(User::getId)
            .orElseThrow();
    }

    public String findFirstNameByEmail(String email) {
        return repository.findByEmail(email).orElseThrow().getFirstName();
    }

    UserProfileResponse getProfile(String email) {
        User user = repository.findByEmail(email).orElseThrow();
        return new UserProfileResponse(user.getEmail(), user.getFirstName(), user.getLastName(), user.getBirthDate());
    }

    @Transactional
    UserProfileResponse updateProfile(String email, UpdateProfileRequest req) {
        User user = repository.findByEmail(email).orElseThrow();
        user.setFirstName(req.firstName().strip());
        user.setLastName(req.lastName() != null ? req.lastName().strip() : null);
        user.setBirthDate(req.birthDate());
        repository.save(user);
        return new UserProfileResponse(user.getEmail(), user.getFirstName(), user.getLastName(), user.getBirthDate());
    }

    @Transactional
    void deleteAccount(String email, String password) {
        User user = repository.findByEmail(email).orElseThrow(InvalidCredentialsException::new);
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN, "Contraseña incorrecta. No se eliminó tu cuenta.");
        }
        events.publishEvent(new UserDeletionRequested(user.getId()));
        jdbc.update("delete from email_outbox where user_id = ?", user.getId());
        jdbc.update("delete from email_verification_tokens where user_id = ?", user.getId());
        repository.delete(user);
        repository.flush();
    }

    User register(String email, String password) {
        if (repository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(email);
        }
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole(Role.PATIENT);
        user.setEmailVerified(false);
        User saved = repository.save(user);
        try {
            verificationService.sendVerificationFor(saved);
        } catch (Exception e) {
            log.warn("No se pudo enviar el email de verificación al registrar usuario (clase: {}). El usuario puede reenviar.",
                    e.getClass().getSimpleName());
        }
        return saved;
    }
}
