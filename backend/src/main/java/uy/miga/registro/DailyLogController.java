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
class DailyLogController {

    private final DailyLogService service;

    @PostMapping("/{date}/items/{id}/resolve")
    ResolveItemResultDto resolveItem(Authentication auth,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @PathVariable Long id, @RequestBody @Valid ResolveItemRequest req) {
        return service.resolveItem(auth.getName(), date, id, req);
    }

    @PostMapping("/{date}/items/resolve/undo")
    PatchItemResultDto undoResolve(Authentication auth,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestBody @Valid UndoResolveRequest req) {
        return service.undoResolve(auth.getName(), date, req);
    }

    DailyLogController(DailyLogService service) {
        this.service = service;
    }

    @PostMapping("/{date}/items/{id}/flexible")
    PatchItemResultDto answerFlexible(Authentication auth,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @PathVariable Long id, @RequestBody @Valid FlexibleAnswerRequest req) {
        return service.answerFlexible(auth.getName(), date, id, req.flexible());
    }

    record FlexibleAnswerRequest(@jakarta.validation.constraints.NotNull Boolean flexible) {}

    // GET  /api/v1/registro/{date} — día completo con comidas, ítems y comparación
    @GetMapping("/{date}")
    DayLogDto getDayLog(Authentication auth,
                                  @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.getDayLog(auth.getName(), date);
    }

    // PUT  /api/v1/registro/{date}/comidas/{mealId}/nota — idempotente
    @PutMapping("/{date}/comidas/{mealId}/nota")
    @ResponseStatus(HttpStatus.CREATED)
    NoteInterpretationDto saveNote(Authentication auth,
                                   @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                   @PathVariable Long mealId,
                                   @RequestBody @Valid NoteRequest req) {
        return service.saveNote(auth.getName(), date, mealId, req.text(), req.version());
    }

    // DELETE /api/v1/registro/{date}/comidas/{mealId}/nota?version= — borra la nota y lo registrado en la comida
    @DeleteMapping("/{date}/comidas/{mealId}/nota")
    DeleteNoteResponse deleteNote(Authentication auth,
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

    @DeleteMapping("/{date}/items/{id}")
    DayLogDto.MealDayDto removeItem(Authentication auth,
                    @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                    @PathVariable Long id,
                    @RequestParam(required = false) Long version) {
        return service.removeItem(auth.getName(), date, id, version);
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
    DayLogDto.MealDayDto saveAnswer(Authentication auth,
                       @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                       @PathVariable Long mealId,
                       @RequestBody AnswerRequest req) {
        return service.saveAnswer(auth.getName(), date, mealId, req);
    }

    // GET  /api/v1/registro/sugerencias?mealId= — top 5 textos frecuentes de esa comida
    @GetMapping("/sugerencias")
    List<String> getSuggestions(Authentication auth,
                                 @RequestParam Long mealId) {
        return service.getSuggestions(auth.getName(), mealId);
    }

    // GET  /api/v1/registro/sin-regla?desde=&hasta= — lo anotado que no se reconoció en el rango
    @GetMapping("/sin-regla")
    List<UnmatchedFoodDto> getUnmatchedFoods(Authentication auth,
                                  @RequestParam(value = "desde") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                  @RequestParam(value = "hasta") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.getUnmatchedFoods(auth.getName(), from, to);
    }

    record DeleteNoteResponse(Long version) {}

    record NoteRequest(@NotBlank @Size(max = 2_000, message = "La nota admite hasta 2000 caracteres.") String text, Long version) {}
}
