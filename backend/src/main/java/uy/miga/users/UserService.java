package uy.miga.users;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UsersRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final VerificationService verificationService;
    private final org.springframework.context.ApplicationEventPublisher events;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    UserService(UsersRepository repository, PasswordEncoder passwordEncoder,
                JwtService jwtService, VerificationService verificationService,
                org.springframework.context.ApplicationEventPublisher events, org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.events = events;
        this.jdbc = jdbc;
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.verificationService = verificationService;
    }

    String login(String email, String password) {
        User user = repository.findByEmail(email)
            .orElseThrow(InvalidCredentialsException::new);
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }
        if (!user.isEmailVerified()) {
            throw new EmailNotVerifiedException();
        }
        return jwtService.generateToken(user);
    }

    public Long findUserIdByEmail(String email) {
        return repository.findByEmail(email)
            .map(User::getId)
            .orElseThrow();
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
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.FORBIDDEN, "Contraseña incorrecta. No se eliminó tu cuenta.");
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
