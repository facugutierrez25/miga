package uy.miga.registro;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/registro")
class RegistroController {

    private final RegistroService service;

    RegistroController(RegistroService service) {
        this.service = service;
    }

    // GET  /api/v1/registro/{date}/{mealId}/note
    @GetMapping("/{date}/{mealId}/note")
    NoteDto getNote(Authentication auth,
                    @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                    @PathVariable Long mealId) {
        return service.getNote(auth.getName(), date, mealId);
    }

    // POST /api/v1/registro/{date}/{mealId}/note  {"text":"..."}
    @PostMapping("/{date}/{mealId}/note")
    @ResponseStatus(HttpStatus.CREATED)
    NoteInterpretationDto saveNote(Authentication auth,
                                   @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                   @PathVariable Long mealId,
                                   @RequestBody NoteRequest req) {
        return service.saveNote(auth.getName(), date, mealId, req.text());
    }

    // GET  /api/v1/registro/{date}/comparacion
    @GetMapping("/{date}/comparacion")
    DayComparisonDto getDayComparison(Authentication auth,
                                      @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.getDayComparison(auth.getName(), date);
    }

    record NoteRequest(String text) {}
}
