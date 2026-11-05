package uy.miga.users;

import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
class UserController {

    private final UserService userService;

    private final RateLimiter rateLimiter;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokens;
    private final AuthCookies cookies;

    UserController(UserService userService, RateLimiter rateLimiter, JwtService jwtService,
                   RefreshTokenService refreshTokens, AuthCookies cookies) {
        this.rateLimiter = rateLimiter;
        this.userService = userService;
        this.jwtService = jwtService;
        this.refreshTokens = refreshTokens;
        this.cookies = cookies;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    void register(@Valid @RequestBody RegisterRequest request) {
        userService.register(request.email(), request.password());
    }

    @PostMapping("/login")
    ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        if (!rateLimiter.allowLoginEmail(request.email())) {
            return ResponseEntity.status(429).header("Retry-After", "900")
                    .header("Content-Type", "application/json;charset=UTF-8").body(RateLimiter.ERROR_JSON);
        }
        User user = userService.authenticate(request.email(), request.password());
        // El refresh token viaja solo en una cookie HttpOnly para restaurar la sesión al volver (ADR 0004).
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookies.create(refreshTokens.issue(user)))
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(new LoginResponse(jwtService.generateToken(user)));
    }

    @GetMapping("/me")
    UserProfileResponse me(Authentication auth) {
        return userService.getProfile(auth.getName());
    }

    @DeleteMapping("/me")
    ResponseEntity<?> deleteMe(Authentication auth, @Valid @RequestBody DeleteAccountRequest request) {
        if (!rateLimiter.allowLoginEmail(auth.getName())) {
            return ResponseEntity.status(429).header("Retry-After", "900")
                .header("Content-Type", "application/json;charset=UTF-8").body(RateLimiter.ERROR_JSON);
        }
        userService.deleteAccount(auth.getName(), request.password());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/me")
    UserProfileResponse updateMe(Authentication auth, @Valid @RequestBody UpdateProfileRequest req) {
        return userService.updateProfile(auth.getName(), req);
    }

}
