package uy.miga.intake;

import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/intake")
class IntakeController {

    private final FoodEntryService service;

    IntakeController(FoodEntryService service) {
        this.service = service;
    }

    @GetMapping("/{date}")
    List<FoodEntryDto> getDay(Authentication auth,
                              @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.getEntriesForDay(auth.getName(), date);
    }

    @PostMapping("/{date}/{mealId}")
    @ResponseStatus(HttpStatus.CREATED)
    FoodEntryDto addEntry(Authentication auth,
                          @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                          @PathVariable Long mealId,
                          @Valid @RequestBody AddFoodEntryRequest req) {
        return service.addEntry(auth.getName(), mealId, date, req.food(), req.quantity(), req.unit(), req.foodGroupId());
    }

    @DeleteMapping("/entries/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteEntry(Authentication auth, @PathVariable Long id) {
        service.deleteEntry(auth.getName(), id);
    }

    @PutMapping("/{date}/{mealId}/consumed")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void markConsumed(Authentication auth,
                      @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                      @PathVariable Long mealId) {
        service.markConsumed(auth.getName(), mealId, date, true);
    }

    @DeleteMapping("/{date}/{mealId}/consumed")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void unmarkConsumed(Authentication auth,
                        @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                        @PathVariable Long mealId) {
        service.markConsumed(auth.getName(), mealId, date, false);
    }
}
