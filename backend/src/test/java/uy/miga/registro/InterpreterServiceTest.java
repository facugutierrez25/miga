package uy.miga.registro;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import uy.miga.reglas.Componente;
import uy.miga.reglas.FoodRuleDto;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class InterpreterServiceTest {

    private InterpreterService interpreter;

    private static FoodRuleDto rule(Long id, String name, List<String> synonyms,
                                    String type, Long groupId, String groupKey,
                                    BigDecimal qtyPerPortion, String unit,
                                    BigDecimal defaultPortion,
                                    List<Componente> components) {
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
    void findRule_levenshtein_paltaToPasta_noMatch_ambiguous() {
        var rules = List.of(
            normal(1L, "palta", 5L, BigDecimal.ONE, "u"),
            normal(2L, "pasta", 2L, new BigDecimal("80"), "g")
        );
        // distance palta↔pasta = 2; two candidates → no match (ambiguous)
        assertThat(interpreter.findRule("posta", rules)).isNull();
    }

    @Test
    void findRule_levenshtein_singleCandidate() {
        var rules = List.of(normal(1L, "palta", 5L, BigDecimal.ONE, "u"));
        // "palto" is distance 1 from "palta" → single candidate → match
        assertThat(interpreter.findRule("palto", rules)).isNotNull();
    }

    @Test
    void findRule_levenshtein_paltaNotMappedToNata() {
        // "nata" is distance 3+ from "palta" → no match
        var rules = List.of(normal(1L, "palta", 5L, BigDecimal.ONE, "u"));
        assertThat(interpreter.findRule("nata", rules)).isNull();
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
    void interpret_libre_returnsOnePortionNoGroup() {
        var rules = List.of(
            rule(1L, "te", List.of(), "LIBRE", null, null, null, null, BigDecimal.ONE, null)
        );
        var item = interpreter.interpret("te", rules).get(0);
        assertThat(item.portions()).isEqualByComparingTo("1");
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
        assertThat(interpreter.levenshtein("palta", "pasta")).isEqualTo(2);
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
}
