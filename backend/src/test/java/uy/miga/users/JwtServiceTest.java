package uy.miga.users;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class JwtServiceTest {
    private static final String SECRET = "test-secret-for-jwt-service-at-least-32-bytes";
    private static final String EMAIL = "user@miga.uy";
    private final SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
    private final UsersRepository users = mock(UsersRepository.class);
    private final JwtService service = new JwtService(SECRET, users);

    @Test void generatedTokenContainsUserIdAndKeepsEmailAsPrincipal() {
        User user = mock(User.class);
        when(user.getId()).thenReturn(42L);
        when(user.getEmail()).thenReturn(EMAIL);
        when(user.getRole()).thenReturn(Role.PATIENT);
        when(users.existsByIdAndEmail(42L, EMAIL)).thenReturn(true);

        String token = service.generateToken(user);
        var claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        assertThat(claims.get("uid", String.class)).isEqualTo("42");
        assertThat(service.extractEmail(token)).contains(EMAIL);
        verify(users).existsByIdAndEmail(42L, EMAIL);
        verifyNoMoreInteractions(users);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "invalid", "9223372036854775808"})
    void rejectsLegacyOrMalformedUserIdWithoutQueryingUsers(String uid) {
        String token = Jwts.builder().subject(EMAIL).claim("uid", uid).signWith(key).compact();

        assertThat(service.extractEmail(token)).isEmpty();
        verifyNoInteractions(users);
    }

    @Test void rejectsMissingUserOrMismatchedEmail() {
        String token = Jwts.builder().subject(EMAIL).claim("uid", "42").signWith(key).compact();
        when(users.existsByIdAndEmail(42L, EMAIL)).thenReturn(false);

        assertThat(service.extractEmail(token)).isEmpty();
        verify(users).existsByIdAndEmail(42L, EMAIL);
        verifyNoMoreInteractions(users);
    }

    @Test void rejectsWrongUserIdClaimType() {
        String token = Jwts.builder().subject(EMAIL).claim("uid", 42).signWith(key).compact();

        assertThat(service.extractEmail(token)).isEmpty();
        verifyNoInteractions(users);
    }
}
