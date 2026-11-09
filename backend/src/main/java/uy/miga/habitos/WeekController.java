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
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import org.springframework.web.server.ResponseStatusException;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.Clock;
import java.time.DayOfWeek;

@RestController
@RequestMapping("/api/v1")
class WeekController {

    private final WeekService service;
    private final Clock clock;

    WeekController(WeekService service, Clock clock) {
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

    // GET /api/v1/semana/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=xlsx|pdf|csv&incluir=texto,porciones,habitos,sinregla
    // Sigue aceptando date= (semana que contiene la fecha) para no romper clientes anteriores.
    @GetMapping("/semana/export")
    void exportWeek(Authentication auth,
                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                    @RequestParam(defaultValue = "csv") String format,
                    @RequestParam(value = "incluir", required = false) String includedSections,
                    HttpServletResponse response) throws IOException {
        if (!List.of("csv", "xlsx", "pdf").contains(format)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Formato inválido.");
        }
        Set<String> sections;
        try {
            sections = WeekExport.parseIncludedSections(includedSections);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Elegí qué incluir: texto, porciones, habitos o sinregla.");
        }
        LocalDate start;
        LocalDate end;
        String fileName;
        if (from != null || to != null) {
            if (from == null || to == null || to.isBefore(from)
                || ChronoUnit.DAYS.between(from, to) >= MAX_EXPORT_DAYS) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Elegí un rango de hasta " + MAX_EXPORT_DAYS + " días.");
            }
            start = from;
            end = to;
            fileName = "miga-" + from + "_" + to;
        } else {
            start = (date != null ? date : LocalDate.now(clock)).with(DayOfWeek.MONDAY);
            end = start.plusDays(6);
            fileName = "semana-" + start;
        }
        WeekExport.Data data = service.getExportData(auth.getName(), start, end, sections);
        response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "." + format + "\"");
        switch (format) {
            case "xlsx" -> {
                response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                WeekExport.writeXlsx(data, response.getOutputStream());
            }
            case "pdf" -> {
                response.setContentType("application/pdf");
                WeekExport.writePdf(data, response.getOutputStream());
            }
            default -> {
                response.setContentType("text/csv");
                response.setCharacterEncoding("UTF-8");
                response.getWriter().write(WeekExport.csv(data));
            }
        }
    }

    static final int MAX_EXPORT_DAYS = 366;

    record LogValueRequest(
        @NotNull(message = "Ingresá un valor.")
        @PositiveOrZero(message = "El valor no puede ser negativo.")
        @DecimalMax(value = "100000", message = "El valor admite hasta 100000.") BigDecimal value) {}
}
