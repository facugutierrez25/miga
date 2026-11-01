package uy.miga.plans;

import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;

@RestController
@RequestMapping("/api/v1/my-plan")
class PlanController {

    private final PlanService planService;

    PlanController(PlanService planService) {
        this.planService = planService;
    }

    @GetMapping
    PlanDto getMyPlan(Authentication auth,
                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return date == null ? planService.getMyPlan(auth.getName())
            : planService.getMyPlanForDate(auth.getName(), date);
    }

    @PutMapping
    PlanDto saveMyPlan(Authentication auth, @Valid @RequestBody PlanSaveDto dto) {
        return planService.saveMyPlan(auth.getName(), dto);
    }

    @GetMapping("/historial")
    List<PlanSummaryDto> getPlanHistory(Authentication auth) {
        return planService.getPlanHistory(auth.getName());
    }
}
