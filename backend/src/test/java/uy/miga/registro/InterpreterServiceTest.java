package uy.miga.registro;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import uy.miga.reglas.RuleComponent;
import uy.miga.reglas.FoodRuleDto;
import uy.miga.reglas.RuleInput;
import uy.miga.reglas.FoodRuleService;
import uy.miga.intake.FoodEntryFacade;
import uy.miga.plans.PlanService;
import uy.miga.plans.PlanFoodGroupDto;
import uy.miga.users.UserService;
import org.mockito.ArgumentCaptor;
import java.time.LocalDate;
import java.time.Clock;
import java.util.UUID;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class InterpreterServiceTest {

    private InterpreterService interpreter;

    @Test
    void unknownMentionPreservesWrittenMeasureForResolution() {
        var item = new InterpreterService().interpret("200 g de zqxalimento", List.of()).getFirst();
        assertThat(item.recognized()).isFalse();
        assertThat(item.foodName()).isEqualTo("zqxalimento");
        assertThat(item.quantity()).isEqualByComparingTo("200");
        assertThat(item.unit()).isEqualTo("g");
        var resolved = new InterpreterService().computePortions(item.originalText(), item.quantity().doubleValue(), item.unit(),
            normal(1L, "equivalente", 1L, new BigDecimal("50"), "g"));
        assertThat(resolved.portions()).isEqualByComparingTo("4");
    }

    @Test
    void bareSameAsUsesDefaultPortion() {
        var item = interpreter.interpret("zqxalimento", List.of()).getFirst();
        assertThat(item.unit()).isNull();
        assertThat(item.quantity()).isEqualByComparingTo("1");
        var equivalent = rule(1L, "equivalente", List.of(), "NORMAL", 7L, null,
            new BigDecimal("50"), "u", new BigDecimal("3"), List.of());
        var resolved = interpreter.computePortions(item.originalText(), item.quantity().doubleValue(), item.unit(), equivalent);
        assertThat(resolved.portions()).isEqualByComparingTo("3");
        assertThat(resolved.portions()).isEqualByComparingTo(interpreter.interpret("equivalente", List.of(equivalent)).getFirst().portions());
    }

    @Test
    void bareGroupsRememberedRuleRoundTrips() {
        var entries = mock(FoodEntryFacade.class);
        var plans = mock(PlanService.class);
        var rules = mock(FoodRuleService.class);
        var users = mock(UserService.class);
        var date = LocalDate.now();
        var entry = new FoodEntryFacade.EntryData(3L, 10L, "zqxalimento", 1.0, null,
            null, false, null, "UNKNOWN", false, null, date, "zqxalimento", null,
            UUID.randomUUID(), null, null, false, null);
        when(users.findUserIdByEmail("user")).thenReturn(1L);
        when(plans.lockCurrentPlan(1L)).thenReturn(20L);
        when(plans.getPlanIdForDate(1L, date)).thenReturn(20L);
        when(plans.getReadData(20L)).thenReturn(new uy.miga.plans.PlanReadData(20L, date, null,
            "PORCIONES", BigDecimal.ZERO, List.of(), List.of(
                new uy.miga.plans.PlanReadData.MealData(10L, "Desayuno", List.of()))));
        when(plans.getPlanFoodGroups(20L)).thenReturn(List.of(
            new PlanFoodGroupDto(7L, "Cereales", "CER", 0, null, "CER", false, false, UUID.randomUUID())));
        when(entries.findEntryByIdAndUserId(anyLong(), eq(1L))).thenReturn(entry);
        when(rules.createUserRule(eq(1L), eq(20L),
            any(RuleInput.class))).thenAnswer(invocation -> {
                RuleInput input = invocation.getArgument(2);
                return rule(1L, input.food(), input.synonyms(), input.type(), input.foodGroupId(), null,
                    input.amountPerPortion(), input.unit(), input.defaultPortions(), input.components());
            });
        var service = DailyLogTestServices.create(mock(MealNoteRepository.class), interpreter,
            mock(ComparisonService.class), entries, plans, rules, users, Clock.systemUTC());
        service.resolveItem("user", date, 3L, new ResolveItemRequest(ResolveItemRequest.Kind.GROUPS, null,
            List.of(new ResolveItemRequest.GroupPortion(7L, new BigDecimal("2"))), true));
        var capture = ArgumentCaptor.forClass(RuleInput.class);
        verify(rules).createUserRule(eq(1L), eq(20L), capture.capture());
        var input = capture.getValue();
        assertThat(input.amountPerPortion()).isNull();
        assertThat(input.unit()).isNull();
        var created = rule(1L, input.food(), input.synonyms(), input.type(), input.foodGroupId(), null,
            input.amountPerPortion(), input.unit(), input.defaultPortions(), input.components());
        assertThat(interpreter.interpret("zqxalimento", List.of(created)).getFirst().portions()).isEqualByComparingTo("2");
    }

    private static FoodRuleDto rule(Long id, String name, List<String> synonyms,
                                    String type, Long groupId, String groupKey,
                                    BigDecimal qtyPerPortion, String unit,
                                    BigDecimal defaultPortion,
                                    List<RuleComponent> components) {
        return new FoodRuleDto(id, "GLOBAL", null, null, name, synonyms, type,
            groupKey, groupId, components, qtyPerPortion, unit, defaultPortion);
    }

    private static FoodRuleDto normal(Long id, String name, Long groupId,
                                       BigDecimal qty, String unit) {
        return rule(id, name, List.of(), "NORMAL", groupId, null, qty, unit,
            BigDecimal.ONE, null);
    }

    private static FoodRuleDto withSynonyms(Long id, String name, List<String> synonyms,
                                             Long groupId) {
        return rule(id, name, synonyms, "NORMAL", groupId, null, null, null,
            BigDecimal.ONE, null);
    }

    @BeforeEach
    void setUp() {
        interpreter = new InterpreterService();
    }

    // ── normalize ────────────────────────────────────────────────────────────

    @Test
    void normalize_removesAccents() {
        assertThat(InterpreterService.normalize("Leché")).isEqualTo("leche");
        assertThat(InterpreterService.normalize("Ñoqui")).isEqualTo("noqui");
        assertThat(InterpreterService.normalize("café")).isEqualTo("cafe");
    }

    @Test
    void normalize_collapsesWhitespace() {
        assertThat(InterpreterService.normalize("  pan   integral  ")).isEqualTo("pan integral");
    }

    // ── splitting ────────────────────────────────────────────────────────────

    @Test
    void interpret_splitsOnComma() {
        var rules = List.of(
            normal(1L, "leche", 4L, BigDecimal.ONE, "taza"),
            normal(2L, "pan", 2L, new BigDecimal("2"), "rebanada")
        );
        var items = interpreter.interpret("leche, pan", rules);
        assertThat(items).hasSize(2);
        assertThat(items.get(0).foodName()).isEqualTo("leche");
        assertThat(items.get(1).foodName()).isEqualTo("pan");
    }

    @Test
    void interpret_splitsOnSemicolon() {
        var rules = List.of(normal(1L, "leche", 4L, BigDecimal.ONE, "taza"));
        var items = interpreter.interpret("leche; leche", rules);
        assertThat(items).hasSize(2);
    }

    @Test
    void interpret_splitsOnPlus() {
        var rules = List.of(normal(1L, "leche", 4L, BigDecimal.ONE, "taza"));
        var items = interpreter.interpret("leche + leche", rules);
        assertThat(items).hasSize(2);
    }

    @Test
    void interpret_emptyText_returnsEmpty() {
        assertThat(interpreter.interpret("", List.of())).isEmpty();
        assertThat(interpreter.interpret(null, List.of())).isEmpty();
        assertThat(interpreter.interpret("   ", List.of())).isEmpty();
    }

    // ── quantity extraction ──────────────────────────────────────────────────

    @Test
    void interpret_parsesNumericQuantity() {
        var rules = List.of(normal(1L, "leche", 4L, BigDecimal.ONE, "taza"));
        var item = interpreter.interpret("2 leche", rules).get(0);
        assertThat(item.quantity()).isEqualByComparingTo("2");
    }

    @Test
    void interpret_parsesDecimalQuantity() {
        var rules = List.of(normal(1L, "leche", 4L, BigDecimal.ONE, "taza"));
        var item = interpreter.interpret("1.5 leche", rules).get(0);
        assertThat(item.quantity()).isEqualByComparingTo("1.5");
    }

    @Test
    void interpret_parsesMedia() {
        var rules = List.of(normal(1L, "leche", 4L, BigDecimal.ONE, "taza"));
        var item = interpreter.interpret("media leche", rules).get(0);
        assertThat(item.quantity()).isEqualByComparingTo("0.5");
    }

    @Test
    void interpret_parsesUno() {
        var rules = List.of(normal(1L, "huevo", 1L, BigDecimal.ONE, "u"));
        var item = interpreter.interpret("un huevo", rules).get(0);
        assertThat(item.quantity()).isEqualByComparingTo("1");
    }

    @Test
    void interpret_defaultsQuantityToOne() {
        var rules = List.of(normal(1L, "leche", 4L, BigDecimal.ONE, "taza"));
        var item = interpreter.interpret("leche", rules).get(0);
        assertThat(item.quantity()).isEqualByComparingTo("1");
    }

    // ── exact matching ───────────────────────────────────────────────────────

    @Test
    void findRule_exactMatchOnName() {
        var rules = List.of(normal(1L, "leche", 4L, BigDecimal.ONE, "taza"));
        assertThat(interpreter.findRule("leche", rules)).isNotNull();
        assertThat(interpreter.findRule("leche", rules).id()).isEqualTo(1L);
    }

    @Test
    void findRule_exactMatchOnSynonym() {
        var rules = List.of(withSynonyms(1L, "leche entera", List.of("leche", "lácteo"), 4L));
        assertThat(interpreter.findRule("lacteo", rules)).isNotNull();
    }

    @Test
    void findRule_noMatchReturnsNull() {
        var rules = List.of(normal(1L, "leche", 4L, BigDecimal.ONE, "taza"));
        assertThat(interpreter.findRule("pizza", rules)).isNull();
    }

    // ── Levenshtein ──────────────────────────────────────────────────────────

    @Test
    void findRule_levenshtein_noMatch_ambiguous() {
        var rules = List.of(
            normal(1L, "posta", 5L, BigDecimal.ONE, "u"),
            normal(2L, "pesta", 2L, new BigDecimal("80"), "g")
        );
        // "pasta" is d=1 from both "posta" and "pesta" → ambiguous → no match
        assertThat(interpreter.findRule("pasta", rules)).isNull();
    }

    @Test
    void findRule_levenshtein_singleCandidate() {
        var rules = List.of(normal(1L, "palta", 5L, BigDecimal.ONE, "u"));
        // "palto" is distance 1 from "palta" → single candidate → match
        assertThat(interpreter.findRule("palto", rules)).isNotNull();
    }

    @Test
    void findRule_levenshtein_shortWordSkipped() {
        // words shorter than 4 chars skip Levenshtein to avoid false positives
        var rules = List.of(normal(1L, "palta", 5L, BigDecimal.ONE, "u"));
        assertThat(interpreter.findRule("pal", rules)).isNull();
    }

    // ── rule types ───────────────────────────────────────────────────────────

    @Test
    void interpret_noCuenta_returnsZeroPortions() {
        var rules = List.of(
            rule(1L, "agua", List.of(), "NO_CUENTA", null, null, null, null, BigDecimal.ONE, null)
        );
        var item = interpreter.interpret("agua", rules).get(0);
        assertThat(item.recognized()).isTrue();
        assertThat(item.portions()).isEqualByComparingTo("0");
    }

    @Test
    void interpret_libre_returnsZeroPortionsNoGroup() {
        var rules = List.of(
            rule(1L, "te", List.of(), "LIBRE", null, null, null, null, BigDecimal.ONE, null)
        );
        var item = interpreter.interpret("te", rules).get(0);
        // LIBRE suma 0 porciones: se registra pero no penaliza en la comparación
        assertThat(item.portions()).isEqualByComparingTo("0");
        assertThat(item.recognized()).isTrue();
    }

    @Test
    void interpret_normalWithQtyAndUnit_calculatesPortions() {
        // 100g yogur = 1 porción; user writes "200g yogur"
        var rules = List.of(normal(1L, "yogur", 4L, new BigDecimal("100"), "g"));
        var item = interpreter.interpret("200g yogur", rules).get(0);
        assertThat(item.portions()).isEqualByComparingTo("2.000");
    }

    @Test
    void interpret_normalWithoutUnit_usesDefaultPortion() {
        var rules = List.of(
            rule(1L, "manzana", List.of(), "NORMAL", 3L, null, null, null,
                new BigDecimal("0.5"), null)
        );
        var item = interpreter.interpret("2 manzana", rules).get(0);
        assertThat(item.portions()).isEqualByComparingTo("1.000");
    }

    @Test
    void interpret_incompatibleUnit_setsUncertain() {
        // rule defined in grams but user writes "2 tazas yogur"
        var rules = List.of(normal(1L, "yogur", 4L, new BigDecimal("100"), "g"));
        var item = interpreter.interpret("2 tazas yogur", rules).get(0);
        assertThat(item.uncertain()).isTrue();
    }

    // ── unit conversion ──────────────────────────────────────────────────────

    @Test
    void convert_mlToTaza() {
        var result = interpreter.convert(new BigDecimal("240"), "ml", "taza");
        assertThat(result).isEqualByComparingTo("1.000");
    }

    @Test
    void convert_kgToG() {
        var result = interpreter.convert(new BigDecimal("0.5"), "kg", "g");
        assertThat(result).isEqualByComparingTo("500.000");
    }

    @Test
    void convert_incompatibleDimension_returnsNull() {
        assertThat(interpreter.convert(BigDecimal.ONE, "ml", "g")).isNull();
    }

    // ── Levenshtein distance ─────────────────────────────────────────────────

    @Test
    void levenshtein_identicalStrings() {
        assertThat(interpreter.levenshtein("leche", "leche")).isZero();
    }

    @Test
    void levenshtein_oneInsertion() {
        assertThat(interpreter.levenshtein("leche", "leches")).isEqualTo(1);
    }

    @Test
    void levenshtein_twoSubstitutions() {
        // "abcd" vs "axyd": b→x and c→y = 2 substitutions
        assertThat(interpreter.levenshtein("abcd", "axyd")).isEqualTo(2);
    }

    // ── unrecognized ─────────────────────────────────────────────────────────

    @Test
    void interpret_unknownFood_returnsUnrecognized() {
        var item = interpreter.interpret("pizza", List.of()).get(0);
        assertThat(item.recognized()).isFalse();
        assertThat(item.portions()).isNull();
        assertThat(item.foodGroupId()).isNull();
    }

    // ── scope priority (tiebreaker order) ───────────────────────────────────

    @Test
    void findRule_preferFirstInList_whenTie() {
        // Rules are pre-sorted by scope priority (USUARIO>PLAN>GLOBAL) by the repository
        var userRule  = rule(10L, "leche", List.of(), "NORMAL", 4L, null, null, null, new BigDecimal("1.5"), null);
        var globalRule = rule(1L, "leche", List.of(), "NORMAL", 4L, null, null, null, BigDecimal.ONE, null);
        var result = interpreter.findRule("leche", List.of(userRule, globalRule));
        assertThat(result.id()).isEqualTo(10L);
    }
    @Test
    void trailingUnitUsesCorrectedEquivalenceForFoodAndSynonym() {
        FoodRuleDto corrected = rule(1L, "yogur prueba", List.of("yogurt"), "NORMAL", 7L, null,
            new BigDecimal("0.667"), "u", BigDecimal.ONE, List.of());
        for (String food : List.of("yogur prueba", "yogurt")) {
            var items = interpreter.interpret("2 " + food + " u", List.of(corrected));
            assertThat(items).hasSize(1);
            assertThat(items.getFirst().unit()).isEqualTo("u");
            assertThat(items.getFirst().portions()).isEqualByComparingTo("2.999");
            assertThat(items.getFirst().uncertain()).isFalse();
        }
    }


    @Test void boundedDistanceMatchesFullDistance() {
        var words = java.util.List.of("", "a", "ab", "abc", "arroz", "arros", "arrozs", "leche", "leches");
        for (String a : words) for (String b : words) for (int max = 0; max <= 3; max++) {
            int[][] full = new int[a.length() + 1][b.length() + 1];
            for (int i = 0; i <= a.length(); i++) full[i][0] = i;
            for (int j = 0; j <= b.length(); j++) full[0][j] = j;
            for (int i = 1; i <= a.length(); i++) for (int j = 1; j <= b.length(); j++)
                full[i][j] = Math.min(full[i-1][j] + 1, Math.min(full[i][j-1] + 1,
                    full[i-1][j-1] + (a.charAt(i-1) == b.charAt(j-1) ? 0 : 1)));
            assertThat(interpreter.levenshtein(a, b, max)).isEqualTo(Math.min(full[a.length()][b.length()], max + 1));
        }
    }

    @Test void boundedDistanceCutsOffAndHandlesLongStringsQuickly() {
        org.junit.jupiter.api.Assertions.assertTimeout(java.time.Duration.ofMillis(50), () -> {
            assertThat(interpreter.levenshtein("a".repeat(2000), "b".repeat(2000), 2)).isEqualTo(3);
            assertThat(interpreter.levenshtein("a".repeat(2000), "a".repeat(2000), 2)).isZero();
            assertThat(interpreter.levenshtein("a".repeat(2000), "a", 2)).isEqualTo(3);
        });
    }

    @Test void longMentionSkipsApproximateMatching() {
        assertThat(interpreter.findRule("a".repeat(101), List.of(normal(1L, "a".repeat(100) + "b", 1L, null, null)))).isNull();
    }
    @Test void legacyLongNamesStillMatchExactlyBySynonymAndPlural() {
        String name = "a".repeat(150);
        var rule = normal(1L, name, 1L, null, null);
        assertThat(interpreter.findRule(name, List.of(rule))).isEqualTo(rule);
        assertThat(interpreter.findRule(name + "s", List.of(rule))).isEqualTo(rule);
        var aliased = withSynonyms(2L, "otro", List.of(name), 1L);
        assertThat(interpreter.findRule(name, List.of(aliased))).isEqualTo(aliased);
        assertThat(interpreter.findRule(name + "s", List.of(aliased))).isEqualTo(aliased);
    }


    @Test void compoundConvertsMeasuredQuantityToPortions() {
        var compound = rule(1L, "Tarta", List.of(), "COMPUESTO", null, null,
            new BigDecimal("150"), "g", BigDecimal.ONE,
            List.of(new RuleComponent(3L, null, 1), new RuleComponent(4L, null, 1)));
        for (String text : List.of("200 g de tarta", "0.2 kg de tarta")) {
            var item = interpreter.interpret(text, List.of(compound)).getFirst();
            assertThat(item.portions()).isEqualTo(new BigDecimal("1.333"));
            assertThat(item.uncertain()).isFalse();
            assertThat(item.appliedRule()).isEqualTo("150 g de Tarta = 1 porción (compuesto)");
        }
        var assumed = interpreter.interpret("2 ml de tarta", List.of(compound)).getFirst();
        assertThat(assumed.portions()).isEqualTo(new BigDecimal("2.000"));
        assertThat(assumed.uncertain()).isTrue();
    }

    @Test void compoundWithoutConversionScalesByQuantityEvenWithAnotherDefaultPortion() {
        var compound = rule(1L, "Tarta", List.of(), "COMPUESTO", null, null, null, null, new BigDecimal("2"),
            List.of(new RuleComponent(3L, null, 1), new RuleComponent(4L, null, 1)));
        assertThat(interpreter.interpret("1 tarta", List.of(compound)).getFirst().portions()).isEqualTo(new BigDecimal("1.000"));
    }

    @Test void compoundWithoutMentionUnitMarksEstimate() {
        for (boolean measured : List.of(true, false)) {
            var compound = rule(1L, "chivito", List.of(), "COMPUESTO", null, null,
                measured ? new BigDecimal("150") : null, measured ? "g" : null, BigDecimal.ONE,
                List.of(new RuleComponent(3L, null, 1), new RuleComponent(4L, null, 1)));
            var item = interpreter.interpret("2 chivitos", List.of(compound)).getFirst();
            assertThat(item.portions()).isEqualTo(new BigDecimal("2.000"));
            assertThat(item.uncertain()).isTrue();
        }
    }


    @Test void personalPluralWinsOverGlobalSynonym() {
        var personal = new FoodRuleDto(2L, "USUARIO", 31L, 7L, "Mandarina", List.of(),
            "NORMAL", null, 1L, List.of(), new BigDecimal("2"), "UNIDAD", BigDecimal.ONE);
        var global = rule(1L, "mandarina", List.of("mandarinas"), "NORMAL", 1L, null,
            new BigDecimal("2"), "unidad", new BigDecimal("2"), null);
        var item = interpreter.interpret("2 mandarinas", List.of(global, personal)).getFirst();
        assertThat(item.ruleId()).isEqualTo(2L);
        assertThat(item.quantity()).isEqualByComparingTo("2");
        assertThat(item.portions()).isEqualByComparingTo("1");
        assertThat(item.uncertain()).isFalse();
    }
    @Test void missingMeasureDoesNotInventGrams() {
        var item = interpreter.interpret("pollo", List.of(normal(1L, "pollo", 1L,
            new BigDecimal("90"), "g"))).getFirst();
        assertThat(item.unit()).isEqualTo("porción");
        assertThat(item.portions()).isEqualByComparingTo("1");
        assertThat(item.uncertain()).isTrue();
    }
    @Test void explicitPiecesUseServingSize() {
        var item = interpreter.interpret("2 galletas", List.of(normal(1L, "galleta", 1L,
            new BigDecimal("2"), "UNIDAD"))).getFirst();
        assertThat(item.quantity()).isEqualByComparingTo("2");
        assertThat(item.portions()).isEqualByComparingTo("1");
        assertThat(item.uncertain()).isFalse();
    }
}
