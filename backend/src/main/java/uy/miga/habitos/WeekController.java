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

    WeekController(WeekService service) {
        this.service = service;
    }

    // GET /api/v1/semana?date=YYYY-MM-DD — semana que contiene la fecha (lunes–domingo)
    @GetMapping("/semana")
    WeekSummaryDto getWeek(Authentication auth,
                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.getWeek(auth.getName(), date != null ? date : LocalDate.now());
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
                         @RequestBody LogValueRequest req) {
        return service.logHabit(auth.getName(), id, date, req.value());
    }

    // GET /api/v1/semana/export?date=YYYY-MM-DD&format=csv
    @GetMapping("/semana/export")
    void exportWeek(Authentication auth,
                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                    @RequestParam(defaultValue = "csv") String format,
                    HttpServletResponse response) throws IOException {
        LocalDate ref = date != null ? date : LocalDate.now();
        WeekSummaryDto week = service.getWeek(auth.getName(), ref);
        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader("Content-Disposition",
            "attachment; filename=\"semana-" + week.weekStart() + ".csv\"");
        response.getWriter().write(buildCsv(week));
    }

    private String buildCsv(WeekSummaryDto week) {
        StringBuilder sb = new StringBuilder();
        sb.append("Fecha,Datos,Porciones registradas,Meta de porciones\n");
        for (WeekDayDto day : week.days()) {
            sb.append(day.date()).append(',')
              .append(day.hasData() ? "sí" : "no").append(',')
              .append(day.totalRecorded()).append(',')
              .append(day.totalGoal()).append('\n');
        }
        return sb.toString();
    }

    record LogValueRequest(BigDecimal value) {}
}
