package uy.miga.registro;

import org.springframework.stereotype.Service;
import uy.miga.intake.FoodEntryFacade;
import uy.miga.reglas.FoodRuleDto;

import java.time.LocalDate;
import java.util.*;

@Service
public class RegistroService {
    private final NoteService noteService;
    private final DayReadService dayReadService;
    private final ItemCorrectionService itemCorrectionService;
    private final ItemResolutionService itemResolutionService;
    RegistroService(NoteService noteService, DayReadService dayReadService, ItemCorrectionService itemCorrectionService,
            ItemResolutionService itemResolutionService) {
        this.noteService = noteService;
        this.dayReadService = dayReadService;
        this.itemCorrectionService = itemCorrectionService;
        this.itemResolutionService = itemResolutionService;
    }

    static final int MAX_RANGE_DAYS = DayReadService.MAX_RANGE_DAYS;
    static String ruleSource(InterpretedItem item, List<FoodRuleDto> rules) { return NoteService.ruleSource(item, rules); }
    static String sourceOf(String alcance) { return NoteService.sourceOf(alcance); }
    public List<WeekMealData> getWeekMeals(String email, LocalDate date) {
        return dayReadService.getWeekMeals(email, date);
    }

    public Map<LocalDate, List<WeekMealData>> getWeekMealsForRange(Long userId, LocalDate start, LocalDate end,
            Map<LocalDate, uy.miga.plans.PlanReadData> plans, List<FoodEntryFacade.EntryData> entries) {
        return dayReadService.getWeekMealsForRange(userId, start, end, plans, entries);
    }

    public boolean planHasNotes(Long planId) {
        return noteService.planHasNotes(planId);
    }

    public void reinterpretTodayNotes(String email, Long planId) {
        noteService.reinterpretTodayNotes(email, planId);
    }

    NoteDto getNote(String userEmail, LocalDate date, Long mealId) {
        return noteService.getNote(userEmail, date, mealId);
    }

    NoteInterpretationDto saveNote(String userEmail, LocalDate date, Long mealId, String text) {
        return noteService.saveNote(userEmail, date, mealId, text);
    }

    NoteInterpretationDto saveNote(String userEmail, LocalDate date, Long mealId, String text, Long version) {
        return noteService.saveNote(userEmail, date, mealId, text, version);
    }

    DayComparisonDto getDayComparison(String userEmail, LocalDate date) {
        return dayReadService.getDayComparison(userEmail, date);
    }

    DayRegistroDto getDayRegistro(String userEmail, LocalDate date) {
        return dayReadService.getDayRegistro(userEmail, date);
    }

    DayRegistroDto.MealDayDto removeItem(String userEmail, LocalDate date, Long entryId, Long version) {
        return itemCorrectionService.removeItem(userEmail, date, entryId, version);
    }

    PatchItemResultDto patchItem(String userEmail, LocalDate date, Long entryId, PatchItemRequest req) {
        return itemCorrectionService.patchItem(userEmail, date, entryId, req);
    }

    ResolveItemResultDto resolveItem(String email, LocalDate date, Long id, ResolveItemRequest req) {
        return itemResolutionService.resolveItem(email, date, id, req);
    }

    PatchItemResultDto undoResolve(String email, LocalDate date, UndoResolveRequest req) {
        return itemResolutionService.undoResolve(email, date, req);
    }

    Long deleteNote(String userEmail, LocalDate date, Long mealId, Long version) {
        return noteService.deleteNote(userEmail, date, mealId, version);
    }

    void saveRespuesta(String userEmail, LocalDate date, Long mealId, RespuestaRequest req) {
        itemCorrectionService.saveRespuesta(userEmail, date, mealId, req);
    }

    public List<SinReglaDto> getSinRegla(Long userId, LocalDate desde, LocalDate hasta) {
        return dayReadService.getSinRegla(userId, desde, hasta);
    }

    List<SinReglaDto> getSinRegla(String userEmail, LocalDate desde, LocalDate hasta) {
        return dayReadService.getSinRegla(userEmail, desde, hasta);
    }

    List<String> getSugerencias(String userEmail, Long mealId) {
        return noteService.getSugerencias(userEmail, mealId);
    }
}
