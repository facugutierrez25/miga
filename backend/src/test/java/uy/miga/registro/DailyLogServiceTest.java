package uy.miga.registro;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;
import uy.miga.intake.FoodEntryFacade;
import uy.miga.plans.PlanNotFoundException;
import uy.miga.plans.PlanService;
import uy.miga.reglas.FoodRuleService;
import uy.miga.reglas.RuleInput;
import uy.miga.users.UserService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class DailyLogServiceTest {
    private final MealNoteRepository notes = mock(MealNoteRepository.class);
    private final FoodEntryFacade entries = mock(FoodEntryFacade.class);
    private final PlanService plans = mock(PlanService.class);
    private final FoodRuleService rules = mock(FoodRuleService.class);
    private final UserService users = mock(UserService.class);
    private final DailyLogService service = DailyLogTestServices.create(notes, mock(InterpreterService.class),
        mock(ComparisonService.class), entries, plans, rules, users, java.time.Clock.system(java.time.ZoneId.of("America/Montevideo")));
    private final LocalDate today = LocalDate.now();

    @BeforeEach
    void setup() {
        when(users.findUserIdByEmail("user")).thenReturn(1L);
        when(plans.lockCurrentPlan(1L)).thenReturn(20L);
        when(plans.getPlanIdForDate(1L, today)).thenReturn(20L);
    }

    @ParameterizedTest
    @ValueSource(strings = {"LIBRE", "FLEXIBLE", "NO_CUENTA", "UNKNOWN"})
    void persistsNonCountingMentionsWithTheirMetadata(String type) {
        InterpreterService interpreter = mock(InterpreterService.class);
        DailyLogService service = DailyLogTestServices.create(notes, interpreter,
            mock(ComparisonService.class), entries, plans, rules, users, java.time.Clock.system(java.time.ZoneId.of("America/Montevideo")));
        when(plans.mealBelongsToUser(10L, 1L)).thenReturn(true);
        when(plans.getMealIds(20L)).thenReturn(List.of(10L));
        when(notes.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        boolean recognized = !"UNKNOWN".equals(type);
        when(rules.findApplicable(20L, 1L)).thenReturn(List.of(new uy.miga.reglas.FoodRuleDto(5L, "GLOBAL", null, null,
            "mate", List.of(), recognized ? type : "NORMAL", null, null, null, null, null, BigDecimal.ZERO)));
        InterpretedItem mention = recognized
            ? new InterpretedItem("mate", "mate", BigDecimal.ONE, "u", null, null,
                BigDecimal.ZERO, "free", false, 5L, null, type)
            : InterpretedItem.unrecognized("mate");
        when(interpreter.interpret(eq("mate"), anyList())).thenReturn(List.of(mention));

        service.saveNote("user", today, 10L, "mate");

        verify(entries).createMentionEntry(eq(1L), eq("user"), eq(10L), eq(today), eq("mate"),
            eq(1.0), eq("u"), isNull(), eq("mate"), eq(false), recognized ? eq("free") : isNull(),
            any(java.util.UUID.class), eq(recognized),
            recognized ? eq(type) : isNull(), recognized ? eq("CATALOGO") : isNull());
        verify(entries, never()).createNoteEntry(any(), any(), any(), any(), any(), any(),
            any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void newTodayNoteRejectsOldMealAfterTakingLock() {
        when(plans.mealBelongsToUser(10L, 1L)).thenReturn(true);
        when(plans.getMealIds(20L)).thenReturn(List.of(11L));

        assertThatThrownBy(() -> service.saveNote("user", today, 10L, "food"))
            .isInstanceOf(PlanChangedException.class);
        var order = inOrder(plans, notes);
        order.verify(plans).lockCurrentPlan(1L);
        order.verify(plans).mealBelongsToUser(10L, 1L);
        order.verify(notes).findByUserIdAndDateAndMealId(1L, today, 10L);
        verify(notes, never()).save(any());
    }

    @Test
    void existingNoteValidatesResolvedDatePlanEvenWithoutCurrentPlan() {
        LocalDate yesterday = today.minusDays(1);
        MealNote note = new MealNote();
        note.setPlanId(19L);
        when(plans.lockCurrentPlan(1L)).thenThrow(new PlanNotFoundException());
        when(plans.mealBelongsToUser(10L, 1L)).thenReturn(true);
        when(notes.findByUserIdAndDateAndMealId(1L, yesterday, 10L)).thenReturn(Optional.of(note));
        when(plans.getPlanIdForDate(1L, yesterday)).thenReturn(19L);
        when(plans.getMealIds(19L)).thenReturn(List.of(9L));

        assertThatThrownBy(() -> service.saveNote("user", yesterday, 10L, "food"))
            .isInstanceOf(PlanChangedException.class);
        verify(plans).getPlanIdForDate(1L, yesterday);
    }

    @Test
    void existingNoteKeepsItsSavedPlanWhenTheMealBelongsToIt() {
        LocalDate yesterday = today.minusDays(1);
        MealNote note = new MealNote();
        note.setPlanId(18L);
        when(plans.mealBelongsToUser(10L, 1L)).thenReturn(true);
        when(notes.findByUserIdAndDateAndMealId(1L, yesterday, 10L)).thenReturn(Optional.of(note));
        when(plans.getMealIds(18L)).thenReturn(List.of(10L));

        try { service.saveNote("user", yesterday, 10L, "food"); } catch (RuntimeException ignored) { }
        verify(plans, never()).getPlanIdForDate(1L, yesterday);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void patchAlwaysLocksBeforeReadingEntry(boolean saveRule) {
        assertThatThrownBy(() -> service.patchItem("user", today, 3L,
            new PatchItemRequest(null, null, null, null, null, saveRule)))
            .isInstanceOf(ResponseStatusException.class);
        var order = inOrder(plans, entries);
        order.verify(plans).lockCurrentPlan(1L);
        order.verify(entries).findEntryByIdAndUserId(3L, 1L);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void respuestaAlwaysLocksAndRejectsStaleMeal(boolean consumed) {
        when(plans.mealBelongsToUser(10L, 1L)).thenReturn(true);
        when(plans.getMealIds(20L)).thenReturn(List.of(11L));
        assertThatThrownBy(() -> service.saveAnswer("user", today, 10L, new AnswerRequest(7L, consumed)))
            .isInstanceOf(PlanChangedException.class);
        var order = inOrder(plans);
        order.verify(plans).lockCurrentPlan(1L);
        order.verify(plans).mealBelongsToUser(10L, 1L);
        verifyNoInteractions(entries);
    }

    @Test
    void patchWithoutRuleToleratesMissingCurrentPlan() {
        when(plans.lockCurrentPlan(1L)).thenThrow(new PlanNotFoundException());
        assertThatThrownBy(() -> service.patchItem("user", today, 3L,
            new PatchItemRequest(null, null, null, null, null, false)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                exception -> assertThat(exception.getStatusCode().value()).isEqualTo(404));
        verify(entries).findEntryByIdAndUserId(3L, 1L);
    }

    @Test
    void versionedNoteRejectsMissingOrStaleVersionBeforeChangingEntries() {
        MealNote note = new MealNote();
        note.setText("original");
        org.springframework.test.util.ReflectionTestUtils.setField(note, "version", 2L);
        when(plans.mealBelongsToUser(10L, 1L)).thenReturn(true);
        when(notes.findByUserIdAndDateAndMealId(1L, today, 10L)).thenReturn(Optional.of(note));
        assertThatThrownBy(() -> service.saveNote("user", today, 10L, "changed", null))
            .isInstanceOf(NoteConflictException.class);
        assertThatThrownBy(() -> service.saveNote("user", today, 10L, "changed", 1L))
            .isInstanceOf(NoteConflictException.class);
        assertThat(note.getText()).isEqualTo("original");
        verifyNoInteractions(entries);
        verify(notes, never()).saveAndFlush(any());
    }

    @Test
    void versionedNoteRejectsVersionWhenNoteDoesNotExist() {
        when(plans.mealBelongsToUser(10L, 1L)).thenReturn(true);
        assertThatThrownBy(() -> service.saveNote("user", today, 10L, "food", 0L))
            .isInstanceOf(NoteConflictException.class);
        verifyNoInteractions(entries);
    }

    @Test
    void identicalVersionedNoteDoesNotRecreateEntriesOrChangeVersion() {
        MealNote note = new MealNote();
        note.setText("leche");
        note.setPlanId(20L);
        note.setMealId(10L);
        org.springframework.test.util.ReflectionTestUtils.setField(note, "version", 2L);
        when(plans.mealBelongsToUser(10L, 1L)).thenReturn(true);
        when(plans.getMealIds(20L)).thenReturn(List.of(10L));
        when(notes.findByUserIdAndDateAndMealId(1L, today, 10L)).thenReturn(Optional.of(note));
        when(notes.findByUserIdAndDate(1L, today)).thenReturn(List.of(note));
        when(plans.getReadData(20L)).thenReturn(new uy.miga.plans.PlanReadData(20L, today, null,
            "LIBRE", new BigDecimal("0.5"), List.of(), List.of(new uy.miga.plans.PlanReadData.MealData(
                10L, "Meal", List.of()))));
        NoteInterpretationDto result = service.saveNote("user", today, 10L, "leche", 2L);
        assertThat(result.version()).isEqualTo(2L);
        verify(notes, never()).saveAndFlush(any());
        verify(entries, never()).deleteNoteEntries(any());
        verifyNoInteractions(rules);
    }

    private void entryWithPortions(BigDecimal portions) {
        when(entries.findEntryByIdAndUserId(3L, 1L)).thenReturn(new FoodEntryFacade.EntryData(
            3L, 11L, "yogur", 2.0, "u", 7L, false, null, "USUARIO", false,
            portions, today, null, "snapshot", null, "NORMAL", "USUARIO", false, null));
        when(plans.getMealIds(20L)).thenReturn(List.of(11L));
    }

    @Test
    void normalRuleStoresPhysicalServingSizeAndOneDefaultPortion() {
        entryWithPortions(BigDecimal.ONE);
        service.patchItem("user", today, 3L,
            new PatchItemRequest(new BigDecimal("2"), null, null, new BigDecimal("3"), null, true));
        ArgumentCaptor<RuleInput> input = ArgumentCaptor.forClass(RuleInput.class);
        verify(rules).upsertUserRule(eq(1L), eq(20L), input.capture());
        assertThat(input.getValue().amountPerPortion()).isEqualByComparingTo("0.667");
        assertThat(input.getValue().defaultPortions()).isEqualByComparingTo("1");
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void normalRuleRejectsMissingOrZeroPortionsBeforeWriting(boolean missing) {
        entryWithPortions(missing ? null : BigDecimal.ZERO);
        assertThatThrownBy(() -> service.patchItem("user", today, 3L,
            new PatchItemRequest(null, null, null, null, null, true)))
            .isInstanceOfSatisfying(ResponseStatusException.class, exception -> {
                assertThat(exception.getStatusCode().value()).isEqualTo(400);
                assertThat(exception.getReason()).isEqualTo("Para guardar como regla, indicá porciones mayores a cero");
            });
        verify(entries, never()).correctEntry(any(), any(), any(), any(), any());
        verifyNoInteractions(rules);
    }

    @Test void oversizedNotesAreRejectedByBothServiceOverloadsBeforeLoadingData() {
        assertThatThrownBy(() -> service.saveNote("user", today, 10L, "a".repeat(2001)))
            .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode().value()).isEqualTo(400));
        assertThatThrownBy(() -> service.saveNote("user", today, 10L, "a".repeat(2001), 1L))
            .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode().value()).isEqualTo(400));
        verifyNoInteractions(notes, entries, rules);
    }

    @Test
    void ruleSourceMapsScopeToOrigin() {
        assertThat(DailyLogService.sourceOf("GLOBAL")).isEqualTo("CATALOGO");
        assertThat(DailyLogService.sourceOf("PLAN")).isEqualTo("PLAN");
        assertThat(DailyLogService.sourceOf("USUARIO")).isEqualTo("USUARIO");
        assertThat(DailyLogService.sourceOf(null)).isNull();
        var personal = new uy.miga.reglas.FoodRuleDto(8L, "USUARIO", 20L, 1L, "pan", List.of(), "NORMAL",
            null, 7L, null, null, null, BigDecimal.ONE);
        var item = new InterpretedItem("pan", "pan", BigDecimal.ONE, "u", 7L, null,
            BigDecimal.ONE, "pan = 1 porción", false, 8L, null, "NORMAL");
        assertThat(DailyLogService.ruleSource(item, List.of(personal))).isEqualTo("USUARIO");
        assertThat(DailyLogService.ruleSource(InterpretedItem.unrecognized("x"), List.of(personal))).isNull();
    }

    @Test
    void recognizedItemPersistsRuleTypeAndPlanSource() {
        InterpreterService interpreter = mock(InterpreterService.class);
        DailyLogService service = DailyLogTestServices.create(notes, interpreter,
            mock(ComparisonService.class), entries, plans, rules, users, java.time.Clock.system(java.time.ZoneId.of("America/Montevideo")));
        when(plans.mealBelongsToUser(10L, 1L)).thenReturn(true);
        when(plans.getMealIds(20L)).thenReturn(List.of(10L));
        when(notes.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(rules.findApplicable(20L, 1L)).thenReturn(List.of(new uy.miga.reglas.FoodRuleDto(6L, "PLAN", 20L, null,
            "yogur", List.of(), "NORMAL", null, 7L, null, null, null, BigDecimal.ONE)));
        when(interpreter.interpret(eq("yogur"), anyList())).thenReturn(List.of(new InterpretedItem("yogur", "yogur",
            BigDecimal.ONE, "u", 7L, null, BigDecimal.ONE, "yogur = 1 porción", false, 6L, null, "NORMAL")));

        service.saveNote("user", today, 10L, "yogur");

        verify(entries).createNoteEntry(eq(1L), eq("user"), eq(10L), eq(today), eq("yogur"), eq(1.0), eq("u"),
            eq(7L), any(), eq("yogur"), eq(false), eq(BigDecimal.ONE), any(), any(java.util.UUID.class),
            eq("NORMAL"), eq("PLAN"));
    }

    @Test
    void sinReglaListsOnlyUnknownMentionsWithMealName() {
        LocalDate monday = LocalDate.of(2026, 11, 2);
        when(entries.findByUserIdAndDateRange(1L, monday, monday.plusDays(6))).thenReturn(List.of(
            new FoodEntryFacade.EntryData(2L, 11L, "chivito", 1.0, "u", null, false, 9L, "UNKNOWN", false,
                null, monday.plusDays(1), "chivito al pan", null, null, null, null, false, null),
            new FoodEntryFacade.EntryData(1L, 10L, "yogur", 1.0, "u", 7L, false, 8L, "REGLA", false,
                BigDecimal.ONE, monday, "yogur", null, null, "NORMAL", "PLAN", false, null),
            new FoodEntryFacade.EntryData(3L, 10L, "torta frita", 1.0, "u", null, false, 8L, "UNKNOWN", false,
                null, monday, null, null, null, null, null, false, null)));
        when(plans.getMealNames(any())).thenReturn(java.util.Map.of(10L, "Desayuno", 11L, "Almuerzo"));

        var result = service.getUnmatchedFoods("user", monday, monday.plusDays(6));

        assertThat(result).containsExactly(
            new UnmatchedFoodDto("torta frita", monday, "Desayuno"),
            new UnmatchedFoodDto("chivito al pan", monday.plusDays(1), "Almuerzo"));
    }

    @Test
    void sinReglaRejectsInvertedOrTooLongRanges() {
        LocalDate day = LocalDate.of(2026, 11, 2);
        for (var range : List.of(List.of(day, day.minusDays(1)), List.of(day, day.plusDays(400)))) {
            assertThatThrownBy(() -> service.getUnmatchedFoods("user", range.get(0), range.get(1)))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                    e -> assertThat(e.getStatusCode().value()).isEqualTo(400));
        }
        verifyNoInteractions(entries);
    }

    @Test
    void weekOmitsMealsThatDoNotApplyThatDayUnlessSomethingWasNoted() {
        LocalDate tuesday = LocalDate.of(2026, 11, 3);
        var plan = new uy.miga.plans.PlanReadData(20L, tuesday.minusDays(7), null, "PORCIONES", new BigDecimal("0.5"),
            List.of(), List.of(
                new uy.miga.plans.PlanReadData.MealData(10L, "Desayuno", List.of()),
                new uy.miga.plans.PlanReadData.MealData(11L, "Pre entreno", List.of(), List.of(1, 3)),
                new uy.miga.plans.PlanReadData.MealData(12L, "Colación", List.of(), List.of(1))));
        MealNote note = new MealNote();
        note.setMealId(12L);
        note.setDate(tuesday);
        note.setText("banana");
        note.setPlanId(20L);
        when(notes.findByUserIdAndDateBetween(1L, tuesday, tuesday)).thenReturn(List.of(note));

        var meals = service.getWeekMealsForRange(1L, tuesday, tuesday,
            new java.util.LinkedHashMap<>(java.util.Map.of(tuesday, plan)), List.of()).get(tuesday);

        assertThat(meals).extracting(WeekMealData::name).containsExactly("Desayuno", "Colación");
    }
}
