package uy.miga.equivalences;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/equivalences")
class EquivalenceController {

    private final EquivalenceService service;

    EquivalenceController(EquivalenceService service) {
        this.service = service;
    }

    @GetMapping
    List<EquivalenceDto> getEquivalences(Authentication auth) {
        return service.getEquivalences(auth.getName());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    EquivalenceDto addEquivalence(Authentication auth,
                                  @Valid @RequestBody AddEquivalenceRequest req) {
        return service.addEquivalence(auth.getName(), req.planId(), req.foodGroupId(), req.food(), req.quantity(), req.unit());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteEquivalence(Authentication auth, @PathVariable Long id) {
        service.deleteEquivalence(auth.getName(), id);
    }
}
