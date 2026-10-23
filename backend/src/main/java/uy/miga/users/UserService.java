package uy.miga.users;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UsersRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final VerificationService verificationService;

    UserService(UsersRepository repository, PasswordEncoder passwordEncoder,
                JwtService jwtService, VerificationService verificationService) {
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
            // El registro no falla si el email no se puede enviar; el usuario puede reenviar
        }
        return saved;
    }
}
