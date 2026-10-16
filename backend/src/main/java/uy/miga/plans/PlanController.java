package uy.miga.plans;

import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/my-plan")
class PlanController {

    private final PlanService planService;

    PlanController(PlanService planService) {
        this.planService = planService;
    }

    @GetMapping
    PlanDto getMyPlan(Authentication auth) {
        return planService.getMyPlan(auth.getName());
    }

    @PutMapping
    PlanDto saveMyPlan(Authentication auth, @Valid @RequestBody PlanDto dto) {
        return planService.saveMyPlan(auth.getName(), dto);
    }

    @GetMapping("/historial")
    List<PlanSummaryDto> getPlanHistory(Authentication auth) {
        return planService.getPlanHistory(auth.getName());
    }
}
