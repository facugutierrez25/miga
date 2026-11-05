package uy.miga.users;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Restaurar y cerrar la sesión con el refresh token de la cookie (ADR 0004). */
@RestController
@RequestMapping("/api/v1/auth")
class SessionController {

    private final RefreshTokenService refreshTokens;
    private final JwtService jwtService;
    private final AuthCookies cookies;

    SessionController(RefreshTokenService refreshTokens, JwtService jwtService, AuthCookies cookies) {
        this.refreshTokens = refreshTokens;
        this.jwtService = jwtService;
        this.cookies = cookies;
    }

    @PostMapping("/refresh")
    ResponseEntity<LoginResponse> refresh(HttpServletRequest request) {
        if (!cookies.originAllowed(request)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        return refreshTokens.rotate(cookies.read(request))
            .map(r -> ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookies.create(r.token()))
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(new LoginResponse(jwtService.generateToken(r.user()))))
            .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .header(HttpHeaders.SET_COOKIE, cookies.clear()).build());
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(HttpServletRequest request) {
        if (!cookies.originAllowed(request)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        refreshTokens.revoke(cookies.read(request));
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookies.clear()).build();
    }
}
