package uy.miga.planrules;

import jakarta.persistence.OptimisticLockException;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;
import uy.miga.plans.DuplicateGroupException;
import uy.miga.plans.PlanNotFoundException;
import uy.miga.plans.PlanVersionConflictException;
import uy.miga.reglas.InvalidRuleException;

import java.util.Map;

@RestControllerAdvice(assignableTypes = PlanRulesController.class)
@Order(-1)
class PlanRulesAdvice {

    @ExceptionHandler({PlanVersionConflictException.class, ObjectOptimisticLockingFailureException.class,
        OptimisticLockException.class})
    ResponseEntity<?> version(Exception e) {
        return error(409, "VERSION_CONFLICT", "El plan cambió en otra sesión. Recargá para ver la versión actual.");
    }

    @ExceptionHandler(GroupInUseException.class)
    ResponseEntity<?> used(GroupInUseException e) {
        return ResponseEntity.status(409).body(Map.of("code", "GROUP_IN_USE", "error", e.getMessage(),
            "comidas", e.meals, "alimentos", e.foods));
    }

    @ExceptionHandler(DuplicateGroupException.class)
    ResponseEntity<?> duplicate(Exception e) {
        return error(409, "DUPLICATE", e.getMessage());
    }

    @ExceptionHandler({InvalidRuleException.class, IllegalArgumentException.class})
    ResponseEntity<?> invalid(Exception e) {
        return error(400, "VALIDATION", e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<?> fields(MethodArgumentNotValidException e) {
        var errors = e.getBindingResult().getFieldErrors().stream()
            .map(f -> uy.miga.ValidationFieldNames.jsonPath(e.getBindingResult(), f.getField()) + ": " + f.getDefaultMessage())
            .toList();
        return ResponseEntity.badRequest().body(Map.of("code", "VALIDATION", "error", "Revisá los datos enviados.", "errors", errors));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
        MissingServletRequestParameterException.class})
    ResponseEntity<?> body(Exception e) {
        return error(400, "VALIDATION", "Revisá los datos enviados.");
    }

    @ExceptionHandler(PlanNotFoundException.class)
    ResponseEntity<?> missing(Exception e) {
        return error(404, "NOT_FOUND", e.getMessage());
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<?> status(ResponseStatusException e) {
        int status = e.getStatusCode().value();
        String reason = e.getReason() == null ? "Recurso no encontrado." : e.getReason();
        return error(status, codeFor(status), reason);
    }

    private static String codeFor(int status) {
        return switch (status) {
            case 400 -> "VALIDATION";
            case 409 -> "DUPLICATE";
            default -> "NOT_FOUND";
        };
    }

    private static ResponseEntity<?> error(int status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of("code", code, "error", message));
    }
}
