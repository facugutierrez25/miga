package uy.miga.planrules;
import org.springframework.core.annotation.Order;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import uy.miga.plans.*;
import uy.miga.reglas.InvalidRuleException;
import java.util.Map;
@RestControllerAdvice(assignableTypes=PlanRulesController.class)
@Order(-1)
class PlanRulesAdvice {
    private ResponseEntity<?> error(int status, String code, String message) { return ResponseEntity.status(status).body(Map.of("code", code, "error", message)); }
    @ExceptionHandler({PlanVersionConflictException.class, ObjectOptimisticLockingFailureException.class, jakarta.persistence.OptimisticLockException.class})
    ResponseEntity<?> version(Exception e) { return error(409, "VERSION_CONFLICT", "El plan cambió en otra sesión. Recargá para ver la versión actual."); }
    @ExceptionHandler(GroupInUseException.class)
    ResponseEntity<?> used(GroupInUseException e) { return ResponseEntity.status(409).body(Map.of("code", "GROUP_IN_USE", "error", e.getMessage(), "comidas", e.comidas, "alimentos", e.alimentos)); }
    @ExceptionHandler(DuplicateGroupException.class)
    ResponseEntity<?> duplicate(Exception e) { return error(409, "DUPLICATE", e.getMessage()); }
    @ExceptionHandler({InvalidRuleException.class, IllegalArgumentException.class})
    ResponseEntity<?> invalid(Exception e) { return error(400, "VALIDATION", e.getMessage()); }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<?> fields(MethodArgumentNotValidException e) {
        var errors = e.getBindingResult().getFieldErrors().stream()
            .map(f -> f.getField() + ": " + f.getDefaultMessage())
            .toList();
        return ResponseEntity.badRequest().body(Map.of("code", "VALIDATION", "error", "Revisá los datos enviados.", "errors", errors));
    }
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class, org.springframework.web.bind.MissingServletRequestParameterException.class})
    ResponseEntity<?> body(Exception e) { return error(400, "VALIDATION", "Revisá los datos enviados."); }
    @ExceptionHandler(PlanNotFoundException.class)
    ResponseEntity<?> missing(Exception e) { return error(404, "NOT_FOUND", e.getMessage()); }
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<?> status(ResponseStatusException e) { return error(e.getStatusCode().value(), e.getStatusCode().value() == 409 ? "DUPLICATE" : "NOT_FOUND", e.getReason() == null ? "Recurso no encontrado." : e.getReason()); }
}
