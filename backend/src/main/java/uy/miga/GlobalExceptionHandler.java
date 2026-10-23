package uy.miga;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import uy.miga.plans.InvalidPortionsException;
import uy.miga.plans.PlanNotFoundException;
import uy.miga.users.EmailAlreadyExistsException;
import uy.miga.users.EmailNotVerifiedException;
import uy.miga.users.InvalidCredentialsException;
import uy.miga.users.InvalidVerificationTokenException;

import java.util.Map;

@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    Map<String, Object> handleValidation(MethodArgumentNotValidException ex) {
        var errors = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .toList();
        return Map.of("errors", errors);
    }

    @ExceptionHandler(EmailAlreadyExistsException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    Map<String, Object> handleEmailExists(EmailAlreadyExistsException ex) {
        return Map.of("error", ex.getMessage());
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    Map<String, Object> handleInvalidCredentials(InvalidCredentialsException ex) {
        return Map.of("error", ex.getMessage());
    }

    @ExceptionHandler(EmailNotVerifiedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    Map<String, Object> handleEmailNotVerified(EmailNotVerifiedException ex) {
        return Map.of("code", "EMAIL_NOT_VERIFIED", "error", "Verificá tu email antes de ingresar.");
    }

    @ExceptionHandler(InvalidVerificationTokenException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    Map<String, Object> handleInvalidToken(InvalidVerificationTokenException ex) {
        return Map.of("code", "INVALID_TOKEN", "error", "El link es inválido o ya expiró.");
    }

    @ExceptionHandler(PlanNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    Map<String, Object> handlePlanNotFound(PlanNotFoundException ex) {
        return Map.of("error", ex.getMessage());
    }

    @ExceptionHandler(InvalidPortionsException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    Map<String, Object> handleInvalidPortions(InvalidPortionsException ex) {
        return Map.of("error", ex.getMessage());
    }
}
