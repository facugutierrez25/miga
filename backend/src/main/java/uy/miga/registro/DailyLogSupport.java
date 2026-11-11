package uy.miga.registro;

import uy.miga.intake.EntryOrigin;

import org.springframework.stereotype.Service;
import uy.miga.intake.FoodEntryFacade;
import uy.miga.plans.PlanService;

import java.util.*;
import uy.miga.plans.PlanNotFoundException;

@Service
class DailyLogSupport {
    private final MealNoteRepository noteRepository;
    private final PlanService planService;

    DailyLogSupport(MealNoteRepository noteRepository, PlanService planService) {
        this.noteRepository = noteRepository;
        this.planService = planService;
    }

    DayLogDto.EntryItemDto toEntryItemDto(FoodEntryFacade.EntryData e) {
        return new DayLogDto.EntryItemDto(
            e.id(), e.food(), e.quantity(), e.unit(), e.foodGroupId(), e.portions(), e.origin(),
            e.uncertain(), e.originalText(), e.appliedRule(), e.occurrenceId(),
            e.ruleType(), e.ruleSource() != null ? e.ruleSource() : (EntryOrigin.USER.equals(e.origin()) ? EntryOrigin.USER : null), e.countsFlexible());
    }

    Long resolveGroupId(String standardGroupKey, Long planId) {
        return planService.findGroupIdByStandardKey(planId, standardGroupKey);
    }

    Long entryPlanId(Long userId, FoodEntryFacade.EntryData entry) {
        if (entry.mealNoteId() != null) {
            Long notePlan = noteRepository.findById(entry.mealNoteId()).map(MealNote::getPlanId).orElse(null);
            if (notePlan != null) return notePlan;
        }
        return planService.getPlanIdForDate(userId, entry.date());
    }

    Long lockCurrentPlanIfPresent(Long userId) {
        try {
            return planService.lockCurrentPlan(userId);
        } catch (PlanNotFoundException ignored) {
            // Un registro histórico puede existir sin plan vigente.
            return null;
        }
    }
}
