package uy.miga.users;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

/**
 * Refresh tokens rotatorios (ADR 0004). El valor solo existe en la cookie del navegador;
 * la base guarda su hash. Cada uso entrega un token nuevo de la misma familia.
 */
@Service
class RefreshTokenService {

    static final Duration LIFETIME = Duration.ofDays(30);
    /** Margen para dos pestañas que refrescan casi a la vez con el mismo token. */
    static final Duration REUSE_GRACE = Duration.ofSeconds(30);

    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenRepository repository;
    private final Clock clock;

    RefreshTokenService(RefreshTokenRepository repository) {
        this.repository = repository;
        this.clock = Clock.systemUTC();
    }

    record Rotation(User user, String token) {}

    @Transactional
    String issue(User user) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        repository.deleteExpiredForUser(user.getId(), now);
        return create(user, UUID.randomUUID(), now);
    }

    /** Rota el token: devuelve el usuario y un token nuevo, o vacío si no es válido. */
    @Transactional
    Optional<Rotation> rotate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return Optional.empty();
        OffsetDateTime now = OffsetDateTime.now(clock);
        Optional<RefreshToken> found = repository.findForUpdate(hash(rawToken));
        if (found.isEmpty()) return Optional.empty();
        RefreshToken token = found.get();
        if (token.getRevokedAt() != null || !token.getExpiresAt().isAfter(now)) return Optional.empty();
        if (token.getUsedAt() != null) {
            // Un token ya usado que vuelve fuera del margen indica que pudo ser robado.
            if (token.getUsedAt().plus(REUSE_GRACE).isBefore(now)) {
                repository.revokeFamily(token.getFamilyId(), now);
            }
            return Optional.empty();
        }
        token.markUsed(now);
        User user = token.getUser();
        // isEmailVerified() inicializa el proxy: el controlador usa el usuario fuera de la transacción.
        if (!user.isEmailVerified()) return Optional.empty();
        return Optional.of(new Rotation(user, create(user, token.getFamilyId(), now)));
    }

    /** Cierra la sesión del dispositivo: revoca toda la familia del token. */
    @Transactional
    void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return;
        repository.findForUpdate(hash(rawToken))
            .ifPresent(t -> repository.revokeFamily(t.getFamilyId(), OffsetDateTime.now(clock)));
    }

    private String create(User user, UUID family, OffsetDateTime now) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        repository.save(new RefreshToken(user, hash(raw), family, now, now.plus(LIFETIME)));
        return raw;
    }

    static String hash(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
