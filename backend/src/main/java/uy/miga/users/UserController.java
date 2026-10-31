package uy.miga.users;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
class UserController {

    private final UserService userService;

    private final RateLimiter rateLimiter;

    UserController(UserService userService, RateLimiter rateLimiter) {
        this.rateLimiter = rateLimiter;
        this.userService = userService;
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
        String token = userService.login(request.email(), request.password());
        return ResponseEntity.ok(new LoginResponse(token));
    }

    @GetMapping("/me")
    UserProfileResponse me(Authentication auth) {
        return userService.getProfile(auth.getName());
    }

    @PatchMapping("/me")
    UserProfileResponse updateMe(Authentication auth, @Valid @RequestBody UpdateProfileRequest req) {
        return userService.updateProfile(auth.getName(), req);
    }

}
