package uy.miga.reglas;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class RuleTextTest {
    @Test
    void describesSingularAndPluralPortions() {
        for (String quantity : List.of("1", "2", "0.5")) {
            BigDecimal portions = new BigDecimal(quantity);
            var rule = new FoodRuleDto(1L, "PLAN", 1L, null, "pan", List.of(),
                "NORMAL", null, 1L, null, null, null, portions);
            assertThat(RuleText.describe(rule, Map.of(1L, "Cereales")))
                .isEqualTo("1 pan = " + quantity.replace('.', ',') + " "
                    + (quantity.equals("1") ? "porción" : "porciones") + " de Cereales");
        }
        assertThat(RuleText.portionUnit(new BigDecimal("1.000"))).isEqualTo("porción");
    }
}
