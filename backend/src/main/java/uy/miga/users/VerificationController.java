package uy.miga.users;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
class VerificationController {

    private final VerificationService verificationService;

    VerificationController(VerificationService verificationService) {
        this.verificationService = verificationService;
    }

    @GetMapping("/verify")
    Map<String, String> verify(@RequestParam String token) {
        verificationService.verify(token);
        return Map.of("message", "Email verificado correctamente.");
    }

    @PostMapping("/resend-verification")
    @ResponseStatus(HttpStatus.ACCEPTED)
    void resend(@Valid @RequestBody ResendRequest request) {
        verificationService.resend(request.email());
    }

    record ResendRequest(@NotBlank @Email String email) {}
}
