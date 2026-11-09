package uy.miga.reglas;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RuleComponentTest {
    @Test
    void legacyJsonAllowsMissingFoodGroupId() throws Exception {
        RuleComponent component = new ObjectMapper().readValue(
            "{\"standardGroupKey\":\"frutas\",\"porciones\":1}", RuleComponent.class);
        assertThat(component.foodGroupId()).isNull();
        assertThat(component.standardGroupKey()).isEqualTo("frutas");
        assertThat(component.portions()).isEqualTo(1);
    }
}
