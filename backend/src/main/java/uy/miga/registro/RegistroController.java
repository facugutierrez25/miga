package uy.miga.registro;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/registro")
public class RegistroController {

    private final RegistroService registroService;

    RegistroController(RegistroService registroService) {
        this.registroService = registroService;
    }

    @GetMapping("/hoy")
    List<Long> getHoy(Authentication auth) {
        return registroService.getTodayLog(auth.getName());
    }

    @PostMapping("/hoy/{mealId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void markEaten(Authentication auth, @PathVariable Long mealId) {
        registroService.markEaten(auth.getName(), mealId);
    }

    @DeleteMapping("/hoy/{mealId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void unmarkEaten(Authentication auth, @PathVariable Long mealId) {
        registroService.unmarkEaten(auth.getName(), mealId);
    }
}
