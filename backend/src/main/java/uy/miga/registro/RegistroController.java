package uy.miga.registro;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/registro")
class RegistroController {

    private final RegistroService service;

    RegistroController(RegistroService service) {
        this.service = service;
    }

    // GET  /api/v1/registro/{date} — día completo con comidas, ítems y comparación
    @GetMapping("/{date}")
    DayRegistroDto getDayRegistro(Authentication auth,
                                  @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.getDayRegistro(auth.getName(), date);
    }

    // PUT  /api/v1/registro/{date}/comidas/{mealId}/nota — idempotente
    @PutMapping("/{date}/comidas/{mealId}/nota")
    @ResponseStatus(HttpStatus.CREATED)
    NoteInterpretationDto saveNota(Authentication auth,
                                   @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                   @PathVariable Long mealId,
                                   @RequestBody @Valid NoteRequest req) {
        return service.saveNote(auth.getName(), date, mealId, req.text(), req.version());
    }

    // DELETE /api/v1/registro/{date}/comidas/{mealId}/nota?version= — borra la nota y lo registrado en la comida
    @DeleteMapping("/{date}/comidas/{mealId}/nota")
    DeleteNoteResponse deleteNota(Authentication auth,
                    @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                    @PathVariable Long mealId,
                    @RequestParam(required = false) Long version) {
        return new DeleteNoteResponse(service.deleteNote(auth.getName(), date, mealId, version));
    }

    // GET  /api/v1/registro/{date}/{mealId}/note — mantenido por compatibilidad temporal
    @GetMapping("/{date}/{mealId}/note")
    NoteDto getNote(Authentication auth,
                    @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                    @PathVariable Long mealId) {
        return service.getNote(auth.getName(), date, mealId);
    }

    // POST /api/v1/registro/{date}/{mealId}/note — mantenido por compatibilidad temporal
    @PostMapping("/{date}/{mealId}/note")
    @ResponseStatus(HttpStatus.CREATED)
    NoteInterpretationDto saveNoteLegacy(Authentication auth,
                                         @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                         @PathVariable Long mealId,
                                         @RequestBody @Valid NoteRequest req) {
        return service.saveNote(auth.getName(), date, mealId, req.text());
    }

    // GET  /api/v1/registro/{date}/comparacion
    @GetMapping("/{date}/comparacion")
    DayComparisonDto getDayComparison(Authentication auth,
                                      @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.getDayComparison(auth.getName(), date);
    }

    // PATCH /api/v1/registro/{date}/items/{id} — corregir cantidad/grupo; saveAsRule crea regla USUARIO
    @PatchMapping("/{date}/items/{id}")
    PatchItemResultDto patchItem(Authentication auth,
                                 @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                 @PathVariable Long id,
                                 @RequestBody @Valid PatchItemRequest req) {
        return service.patchItem(auth.getName(), date, id, req);
    }

    // POST /api/v1/registro/{date}/comidas/{mealId}/respuestas — responder preguntar_si_falta
    @PostMapping("/{date}/comidas/{mealId}/respuestas")
    @ResponseStatus(HttpStatus.CREATED)
    void saveRespuesta(Authentication auth,
                       @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                       @PathVariable Long mealId,
                       @RequestBody RespuestaRequest req) {
        service.saveRespuesta(auth.getName(), date, mealId, req);
    }

    // GET  /api/v1/registro/sugerencias?mealId= — top 5 textos frecuentes de esa comida
    @GetMapping("/sugerencias")
    List<String> getSugerencias(Authentication auth,
                                 @RequestParam Long mealId) {
        return service.getSugerencias(auth.getName(), mealId);
    }

    record DeleteNoteResponse(Long version) {}

    record NoteRequest(@NotBlank @Size(max = 10_000) String text, Long version) {}
}
