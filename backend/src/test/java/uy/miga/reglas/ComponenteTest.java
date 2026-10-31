package uy.miga.reglas;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ComponenteTest {
    @Test
    void legacyJsonAllowsMissingFoodGroupId() throws Exception {
        Componente component = new ObjectMapper().readValue(
            "{\"standardGroupKey\":\"frutas\",\"porciones\":1}", Componente.class);
        assertThat(component.foodGroupId()).isNull();
        assertThat(component.standardGroupKey()).isEqualTo("frutas");
        assertThat(component.porciones()).isEqualTo(1);
    }
}
