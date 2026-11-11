package uy.miga.registro;

import uy.miga.intake.FoodEntryFacade;
import uy.miga.plans.PlanService;
import uy.miga.reglas.FoodRuleService;
import uy.miga.users.UserService;

final class DailyLogTestServices {
    static DailyLogService create(MealNoteRepository notes, InterpreterService interpreter,
            ComparisonService comparison, FoodEntryFacade entries, PlanService plans,
            FoodRuleService rules, UserService users, java.time.Clock clock) {
        var support = new DailyLogSupport(notes, plans);
        var reads = new DayReadService(notes, interpreter, rules, comparison, entries, plans, users, support);
        var ruleInputMapper = new RegistrationRuleInputMapper(plans, support);
        return new DailyLogService(
            new NoteService(notes, interpreter, comparison, entries, plans, rules, users, clock, support, reads),
            reads, new ItemCorrectionService(notes, entries, plans, rules, users, support, reads, interpreter, ruleInputMapper),
            new ItemResolutionService(interpreter, entries, plans, rules, users, support, reads, ruleInputMapper));
    }
}
