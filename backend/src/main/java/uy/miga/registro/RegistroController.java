package uy.miga.registro;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/registro")
public class RegistroController {

    private final RegistroService registroService;

    RegistroController(RegistroService registroService) {
        this.registroService = registroService;
    }

    @GetMapping("/{date}")
    List<Long> getLog(Authentication auth,
                      @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return registroService.getLog(auth.getName(), date);
    }

    @PostMapping("/{date}/{mealId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void markEaten(Authentication auth,
                   @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                   @PathVariable Long mealId) {
        registroService.markEaten(auth.getName(), mealId, date);
    }

    @DeleteMapping("/{date}/{mealId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void unmarkEaten(Authentication auth,
                     @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                     @PathVariable Long mealId) {
        registroService.unmarkEaten(auth.getName(), mealId, date);
    }
}
