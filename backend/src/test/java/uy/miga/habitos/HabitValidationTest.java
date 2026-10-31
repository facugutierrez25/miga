package uy.miga.habitos;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

class HabitValidationTest {
    @Test void numericLogsAcceptBothLimitsAndRejectValuesOutsideThem() {
        for (HabitType type : new HabitType[] {HabitType.CONTADOR, HabitType.CANTIDAD}) {
            assertThatCode(() -> HabitValidation.log(type, BigDecimal.ZERO)).doesNotThrowAnyException();
            assertThatCode(() -> HabitValidation.log(type, new BigDecimal("100000"))).doesNotThrowAnyException();
            for (BigDecimal value : new BigDecimal[] {null, new BigDecimal("-1"), new BigDecimal("100001")}) {
                assertThatThrownBy(() -> HabitValidation.log(type, value))
                    .isInstanceOfSatisfying(ResponseStatusException.class, ex -> {
                        assertThat(ex.getStatusCode().value()).isEqualTo(400);
                        assertThat(ex.getReason()).isEqualTo("El valor debe estar entre 0 y 100000.");
                    });
            }
        }
    }

    @Test void booleanLogsOnlyAcceptZeroOrOne() {
        for (String value : new String[] {"0", "1", "1.00"}) {
            assertThatCode(() -> HabitValidation.log(HabitType.SI_NO, new BigDecimal(value)))
                .doesNotThrowAnyException();
        }
        for (String value : new String[] {"2", "0.5"}) {
            assertThatThrownBy(() -> HabitValidation.log(HabitType.SI_NO, new BigDecimal(value)))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex -> {
                    assertThat(ex.getStatusCode().value()).isEqualTo(400);
                    assertThat(ex.getReason()).isEqualTo("Para un hábito sí/no, ingresá 0 o 1.");
                });
        }
    }
}
