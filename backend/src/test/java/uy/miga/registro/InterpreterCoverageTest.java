package uy.miga.registro;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import uy.miga.reglas.Componente;
import uy.miga.reglas.FoodRuleDto;

import java.io.InputStream;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

/**
 * Coverage test: ≥85% of "shouldRecognize=true" entries must be recognized.
 * Zero false positives: "shouldRecognize=false" entries must NOT receive portions.
 */
class InterpreterCoverageTest {

    private static final double COVERAGE_THRESHOLD = 0.85;
    private static List<FoodRuleDto> rules;
    private static List<EntryFixture> fixtures;
    private final InterpreterService interpreter = new InterpreterService();

    @BeforeAll
    static void loadFixtures() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        try (InputStream rulesStream = InterpreterCoverageTest.class
                .getResourceAsStream("/registro/rules-coverage.json")) {
            RuleJson[] ruleArray = mapper.readValue(rulesStream, RuleJson[].class);
            rules = Arrays.stream(ruleArray).map(InterpreterCoverageTest::toDto).toList();
        }
        try (InputStream entriesStream = InterpreterCoverageTest.class
                .getResourceAsStream("/registro/entries-coverage.json")) {
            fixtures = Arrays.asList(mapper.readValue(entriesStream, EntryFixture[].class));
        }
    }

    @Test
    void coverageAboveThreshold() {
        List<EntryFixture> shouldRecognize = fixtures.stream()
            .filter(f -> f.shouldRecognize).toList();

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
    void zeroFalsePositives() {
        List<EntryFixture> shouldNotRecognize = fixtures.stream()
            .filter(f -> !f.shouldRecognize).toList();

        for (EntryFixture fixture : shouldNotRecognize) {
            var items = interpreter.interpret(fixture.text, rules);
            boolean anyWithPortions = items.stream()
                .anyMatch(i -> i.recognized() && i.portions() != null
                    && i.portions().compareTo(BigDecimal.ZERO) > 0
                    && i.foodGroupId() != null);
            if (anyWithPortions) {
                fail("False positive: \"" + fixture.text + "\" was assigned portions but should not be recognized");
            }
        }
    }

    // ── JSON deserialization helpers ─────────────────────────────────────────

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

    private static FoodRuleDto toDto(RuleJson r) {
        return new FoodRuleDto(
            r.id, r.alcance, null, null, r.alimento, r.sinonimos, r.tipo,
            r.standardGroupKey, r.foodGroupId, r.componentes,
            r.cantidadPorPorcion != null ? BigDecimal.valueOf(r.cantidadPorPorcion) : null,
            r.unidad,
            r.porcionPorDefecto != null ? BigDecimal.valueOf(r.porcionPorDefecto) : BigDecimal.ONE
        );
    }
}
