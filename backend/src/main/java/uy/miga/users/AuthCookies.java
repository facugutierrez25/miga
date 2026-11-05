package uy.miga.users;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsConfiguration;

import java.util.Arrays;
import java.util.List;

/**
 * Cookie del refresh token y control de origen para los endpoints que la usan.
 * La cookie es HttpOnly, Secure y SameSite=Strict, y solo viaja a /api/v1/auth.
 * Como esos endpoints actúan con una cookie, además exigen un Origin permitido (CSRF).
 */
@Component
class AuthCookies {

    static final String NAME = "miga_rt";
    static final String PATH = "/api/v1/auth";

    private final boolean secure;
    private final CorsConfiguration origins = new CorsConfiguration();

    AuthCookies(@Value("${app.auth.cookie-secure:true}") boolean secure,
                @Value("${app.cors.allowed-origins}") List<String> allowedOrigins,
                @Value("${app.cors.allowed-origin-patterns:}") List<String> allowedOriginPatterns) {
        this.secure = secure;
        origins.setAllowedOrigins(allowedOrigins.stream().map(String::strip).filter(o -> !o.isEmpty()).toList());
        origins.setAllowedOriginPatterns(allowedOriginPatterns.stream().map(String::strip).filter(p -> !p.isEmpty()).toList());
    }

    String create(String token) {
        return ResponseCookie.from(NAME, token).httpOnly(true).secure(secure).sameSite("Strict")
            .path(PATH).maxAge(RefreshTokenService.LIFETIME).build().toString();
    }

    String clear() {
        return ResponseCookie.from(NAME, "").httpOnly(true).secure(secure).sameSite("Strict")
            .path(PATH).maxAge(0).build().toString();
    }

    String read(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        return Arrays.stream(cookies).filter(c -> NAME.equals(c.getName())).map(Cookie::getValue)
            .findFirst().orElse(null);
    }

    boolean originAllowed(HttpServletRequest request) {
        String origin = request.getHeader("Origin");
        return origin != null && origins.checkOrigin(origin) != null;
    }
}
