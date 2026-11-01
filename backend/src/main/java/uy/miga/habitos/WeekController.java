package uy.miga.habitos;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
class WeekController {

    private final WeekService service;
    private final java.time.Clock clock;

    WeekController(WeekService service, java.time.Clock clock) {
        this.clock = clock;
        this.service = service;
    }

    // GET /api/v1/semana?date=YYYY-MM-DD — semana que contiene la fecha (lunes–domingo)
    @GetMapping("/semana")
    WeekSummaryDto getWeek(Authentication auth,
                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.getWeek(auth.getName(), date != null ? date : LocalDate.now(clock));
    }

    // GET /api/v1/habitos
    @GetMapping("/habitos")
    List<HabitDto> getHabits(Authentication auth) {
        return service.getHabits(auth.getName());
    }

    // POST /api/v1/habitos
    @PostMapping("/habitos")
    @ResponseStatus(HttpStatus.CREATED)
    HabitDto createHabit(Authentication auth, @Valid @RequestBody HabitSaveDto dto) {
        return service.createHabit(auth.getName(), dto);
    }

    // PUT /api/v1/habitos/{id}/log
    @PutMapping("/habitos/{id}/log")
    @ResponseStatus(HttpStatus.CREATED)
    HabitLogDto logHabit(Authentication auth,
                         @PathVariable Long id,
                         @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                         @Valid @RequestBody LogValueRequest req) {
        return service.logHabit(auth.getName(), id, date, req.value());
    }

    // GET /api/v1/semana/export?date=YYYY-MM-DD&format=csv
    @GetMapping("/semana/export")
    void exportWeek(Authentication auth,
                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                    @RequestParam(defaultValue = "csv") String format,
                    HttpServletResponse response) throws IOException {
        LocalDate ref = date != null ? date : LocalDate.now(clock);
        WeekSummaryDto week = service.getWeek(auth.getName(), ref);
        if (!List.of("csv", "xlsx").contains(format)) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST, "Formato inválido.");
        }
        response.setHeader("Content-Disposition", "attachment; filename=\"semana-" + week.weekStart() + "." + format + "\"");
        if ("xlsx".equals(format)) {
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            WeekExport.writeXlsx(week, response.getOutputStream());
        } else {
            response.setContentType("text/csv");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(WeekExport.csv(week));
        }
    }

    record LogValueRequest(
        @jakarta.validation.constraints.NotNull(message = "Ingresá un valor.")
        @jakarta.validation.constraints.PositiveOrZero(message = "El valor no puede ser negativo.")
        @jakarta.validation.constraints.DecimalMax(value = "100000", message = "El valor admite hasta 100000.") BigDecimal value) {}
}
