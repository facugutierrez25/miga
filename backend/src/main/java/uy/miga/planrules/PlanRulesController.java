package uy.miga.planrules;

import jakarta.validation.Valid;
import jakarta.validation.groups.Default;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/my-plan")
class PlanRulesController {
    private final PlanRulesService service;

    PlanRulesController(PlanRulesService service) {
        this.service = service;
    }

    @GetMapping("/reglas")
    PlanRulesDto get(Authentication auth) {
        return service.get(auth.getName());
    }

    @GetMapping("/catalogo")
    List<PlanRulesDto.CatalogDto> catalog(Authentication auth, @RequestParam(defaultValue = "") String q) {
        return service.catalog(auth.getName(), q);
    }

    @PostMapping("/catalogo/{uid}/ajustar")
    @ResponseStatus(HttpStatus.CREATED)
    PlanRulesDto adjust(Authentication auth, @PathVariable UUID uid, @Valid @RequestBody Requests.Version req) {
        return service.adjust(auth.getName(), uid, req);
    }

    @PutMapping("/grupos/orden")
    PlanRulesDto order(Authentication auth, @Valid @RequestBody Requests.Order req) {
        return service.order(auth.getName(), req);
    }

    @PostMapping("/grupos")
    @ResponseStatus(HttpStatus.CREATED)
    PlanRulesDto createGroup(Authentication auth, @Valid @RequestBody Requests.Group req) {
        return service.group(auth.getName(), null, req);
    }

    @PutMapping("/grupos/{uid}")
    PlanRulesDto updateGroup(Authentication auth, @PathVariable UUID uid, @Valid @RequestBody Requests.Group req) {
        return service.group(auth.getName(), uid, req);
    }

    @DeleteMapping("/grupos/{uid}")
    PlanRulesDto deleteGroup(Authentication auth, @PathVariable UUID uid, @RequestParam Long planVersion) {
        return service.deleteGroup(auth.getName(), uid, planVersion);
    }

    // Al crear se validan también los límites de largo (grupo CreateRule).
    @PostMapping("/alimentos")
    @ResponseStatus(HttpStatus.CREATED)
    PlanRulesDto createRule(Authentication auth,
                            @Validated({Default.class, Requests.CreateRule.class}) @RequestBody Requests.Rule req) {
        return service.rule(auth.getName(), null, req);
    }

    @PutMapping("/alimentos/{uid}")
    PlanRulesDto updateRule(Authentication auth, @PathVariable UUID uid, @Valid @RequestBody Requests.Rule req) {
        return service.rule(auth.getName(), uid, req);
    }

    @DeleteMapping("/alimentos/{uid}")
    PlanRulesDto deleteRule(Authentication auth, @PathVariable UUID uid, @RequestParam Long planVersion) {
        return service.deleteRule(auth.getName(), uid, planVersion);
    }

    @PostMapping("/habitos")
    @ResponseStatus(HttpStatus.CREATED)
    PlanRulesDto createHabit(Authentication auth, @Valid @RequestBody Requests.Habit req) {
        return service.habit(auth.getName(), null, req);
    }

    @PutMapping("/habitos/{uid}")
    PlanRulesDto updateHabit(Authentication auth, @PathVariable UUID uid, @Valid @RequestBody Requests.Habit req) {
        return service.habit(auth.getName(), uid, req);
    }

    @DeleteMapping("/habitos/{uid}")
    PlanRulesDto deleteHabit(Authentication auth, @PathVariable UUID uid, @RequestParam Long planVersion) {
        return service.deleteHabit(auth.getName(), uid, planVersion);
    }
}
