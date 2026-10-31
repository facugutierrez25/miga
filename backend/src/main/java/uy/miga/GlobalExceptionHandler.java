package uy.miga;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import uy.miga.plans.InvalidPortionsException;
import uy.miga.plans.PlanConflictException;
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

    @ExceptionHandler(uy.miga.plans.PlanVersionConflictException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    Map<String, Object> handlePlanVersionConflict(uy.miga.plans.PlanVersionConflictException ex) {
        return Map.of("code", "VERSION_CONFLICT", "error", ex.getMessage());
    }

    @ExceptionHandler(PlanConflictException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    Map<String, Object> handlePlanConflict(PlanConflictException ex) {
        return Map.of("code", "PLAN_CONFLICT", "error", ex.getMessage());
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    Map<String, Object> handleOptimisticLock(ObjectOptimisticLockingFailureException ex) {
        return Map.of("code", "PLAN_CONFLICT", "error", "El plan fue modificado por otra sesión. Recargá para ver la versión actual.");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    Map<String, Object> handleDataIntegrity(DataIntegrityViolationException ex) {
        return Map.of("code", "PLAN_CONFLICT", "error", "Operación rechazada por restricción de integridad. Intentá de nuevo.");
    }
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    org.springframework.http.ResponseEntity<?> handleStatus(org.springframework.web.server.ResponseStatusException ex) {
        return org.springframework.http.ResponseEntity.status(ex.getStatusCode())
            .body(Map.of("error", ex.getReason() == null ? "No se pudo completar la solicitud." : ex.getReason()));
    }
}
