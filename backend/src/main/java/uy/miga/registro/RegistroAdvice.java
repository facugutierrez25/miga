package uy.miga.registro;

import jakarta.persistence.OptimisticLockException;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice(assignableTypes = RegistroController.class)
@Order(-1)
class RegistroAdvice {

    @ExceptionHandler({NoteConflictException.class, ObjectOptimisticLockingFailureException.class,
        OptimisticLockException.class})
    ResponseEntity<?> noteConflict(Exception exception) {
        return ResponseEntity.status(409).body(Map.of(
            "code", "NOTE_CONFLICT",
            "error", "Esta nota cambió en otro dispositivo. Recargá para ver la versión actual."));
    }

    @ExceptionHandler(PlanChangedException.class)
    ResponseEntity<?> planChanged() {
        return ResponseEntity.status(409).body(Map.of(
            "code", "PLAN_CHANGED",
            "error", "Tu plan cambió. Recargá para ver las comidas actuales."));
    }
}
