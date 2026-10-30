package uy.miga.registro;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import uy.miga.reglas.Componente;
import uy.miga.reglas.FoodRuleDto;

import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

/**
 * Coverage test: ≥85% of shouldRecognize=true entries must be recognized with correct group.
 * Zero false positives: shouldRecognize=false entries must not receive portions > 0 with a group.
 */
class InterpreterCoverageTest {

    private static final double COVERAGE_THRESHOLD = 0.85;
    private final InterpreterService interpreter = new InterpreterService();
    private final ObjectMapper objectMapper = new ObjectMapper();

    static Stream<Arguments> planFixtures() {
        return Stream.of(
            Arguments.of("Plan A (estándar)", "registro/rules-plan-a.json", "registro/entries-plan-a.json"),
            Arguments.of("Plan B (huevos/panificados separados, FLEXIBLE)", "registro/rules-plan-b.json", "registro/entries-plan-b.json"),
            Arguments.of("Plan C (todo LIBRE)", "registro/rules-plan-c.json", "registro/entries-plan-c.json")
        );
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("planFixtures")
    void coverageAboveThreshold(String planName, String rulesFile, String entriesFile) throws Exception {
        List<FoodRuleDto> rules = loadRules(rulesFile);
        List<EntryFixture> fixtures = loadFixtures(entriesFile);

        List<EntryFixture> shouldRecognize = fixtures.stream().filter(f -> f.shouldRecognize).toList();
        List<String> failed = new ArrayList<>();

        long correct = 0;
        for (EntryFixture f : shouldRecognize) {
            var items = interpreter.interpret(f.text, rules);
            boolean recognized = items.stream().anyMatch(InterpretedItem::recognized);
            boolean groupCorrect = f.expected == null
                ? recognized
                : items.stream().anyMatch(i -> i.recognized() && f.expected.equals(i.standardGroupKey()));
            if (groupCorrect) {
                correct++;
            } else {
                failed.add(String.format("  [%s] \"%s\" → expected group=%s, got=%s",
                    planName, f.text, f.expected,
                    items.stream().filter(InterpretedItem::recognized)
                        .map(InterpretedItem::standardGroupKey).toList()));
            }
        }

        if (!failed.isEmpty()) {
            System.out.println("Casos fallidos en " + planName + ":");
            failed.forEach(System.out::println);
        }

        double coverage = (double) correct / shouldRecognize.size();
        assertThat(coverage)
            .as("Cobertura %.0f%% por debajo del umbral %.0f%% (%d/%d correctos) en %s",
                coverage * 100, COVERAGE_THRESHOLD * 100, correct, shouldRecognize.size(), planName)
            .isGreaterThanOrEqualTo(COVERAGE_THRESHOLD);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("planFixtures")
    void zeroFalsePositives(String planName, String rulesFile, String entriesFile) throws Exception {
        List<FoodRuleDto> rules = loadRules(rulesFile);
        List<EntryFixture> fixtures = loadFixtures(entriesFile);

        for (EntryFixture f : fixtures.stream().filter(x -> !x.shouldRecognize).toList()) {
            var items = interpreter.interpret(f.text, rules);
            boolean falsePositive = items.stream()
                .anyMatch(i -> i.recognized()
                    && i.portions() != null
                    && i.portions().compareTo(BigDecimal.ZERO) > 0
                    && i.foodGroupId() != null);
            if (falsePositive) {
                fail(String.format("[%s] Falso positivo: \"%s\" recibió porciones pero no debería reconocerse",
                    planName, f.text));
            }
        }
    }

    // ── legacy single-fixture test (backwards compatibility) ─────────────────

    @Test
    void legacy_coverageAboveThreshold() throws Exception {
        List<FoodRuleDto> rules = loadRules("registro/rules-coverage.json");
        List<EntryFixture> fixtures = loadFixtures("registro/entries-coverage.json");

        List<EntryFixture> shouldRecognize = fixtures.stream().filter(f -> f.shouldRecognize).toList();
        long recognized = shouldRecognize.stream().filter(f -> {
            var items = interpreter.interpret(f.text, rules);
            return items.stream().anyMatch(InterpretedItem::recognized);
        }).count();

        double coverage = (double) recognized / shouldRecognize.size();
        assertThat(coverage)
            .as("Coverage %.0f%% below threshold %.0f%% (%d/%d recognized)",
                coverage * 100, COVERAGE_THRESHOLD * 100, recognized, shouldRecognize.size())
            .isGreaterThanOrEqualTo(COVERAGE_THRESHOLD);
    }

    @Test
    void legacy_zeroFalsePositives() throws Exception {
        List<FoodRuleDto> rules = loadRules("registro/rules-coverage.json");
        List<EntryFixture> fixtures = loadFixtures("registro/entries-coverage.json");

        for (EntryFixture f : fixtures.stream().filter(x -> !x.shouldRecognize).toList()) {
            var items = interpreter.interpret(f.text, rules);
            boolean anyWithPortions = items.stream()
                .anyMatch(i -> i.recognized() && i.portions() != null
                    && i.portions().compareTo(BigDecimal.ZERO) > 0
                    && i.foodGroupId() != null);
            if (anyWithPortions) {
                fail("False positive: \"" + f.text + "\" was assigned portions but should not be recognized");
            }
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    record EntryFixture(String text, String expected, boolean shouldRecognize) {}

    static class RuleJson {
        public Long id;
        public String alcance;
        public String alimento;
        public List<String> sinonimos;
        public String tipo;
        public String standardGroupKey;
        public Long foodGroupId;
        public List<Componente> componentes;
        public Double cantidadPorPorcion;
        public String unidad;
        public Double porcionPorDefecto;
    }

    private List<FoodRuleDto> loadRules(String path) throws Exception {
        ClassLoader cl = Thread.currentThread().getContextClassLoader();
        try (InputStream is = cl.getResourceAsStream(path)) {
            return Arrays.stream(objectMapper.readValue(is, RuleJson[].class))
                .map(this::toDto).toList();
        }
    }

    private List<EntryFixture> loadFixtures(String path) throws Exception {
        ClassLoader cl = Thread.currentThread().getContextClassLoader();
        try (InputStream is = cl.getResourceAsStream(path)) {
            return Arrays.asList(objectMapper.readValue(is, EntryFixture[].class));
        }
    }

    private FoodRuleDto toDto(RuleJson r) {
        return new FoodRuleDto(
            r.id, r.alcance, null, null, r.alimento, r.sinonimos, r.tipo,
            r.standardGroupKey, r.foodGroupId, r.componentes,
            r.cantidadPorPorcion != null ? BigDecimal.valueOf(r.cantidadPorPorcion) : null,
            r.unidad,
            r.porcionPorDefecto != null ? BigDecimal.valueOf(r.porcionPorDefecto) : BigDecimal.ONE
        );
    }
}
