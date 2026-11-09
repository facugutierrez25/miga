package uy.miga.registro;

import uy.miga.intake.FoodEntryFacade;
import uy.miga.plans.PlanService;
import uy.miga.reglas.ReglaService;
import uy.miga.users.UserService;

final class RegistroTestServices {
    static RegistroService create(MealNoteRepository notes, InterpreterService interpreter,
            ComparisonService comparison, FoodEntryFacade entries, PlanService plans,
            ReglaService rules, UserService users, java.time.Clock clock) {
        var support = new RegistroSupport(notes, plans);
        var reads = new DayReadService(notes, interpreter, rules, comparison, entries, plans, users, support);
        return new RegistroService(
            new NoteService(notes, interpreter, comparison, entries, plans, rules, users, clock, support, reads),
            reads, new ItemCorrectionService(notes, entries, plans, rules, users, support, reads),
            new ItemResolutionService(interpreter, entries, plans, rules, users, support));
    }
}
