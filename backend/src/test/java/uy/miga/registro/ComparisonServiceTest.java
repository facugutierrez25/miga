package uy.miga.registro;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.Arguments;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class ComparisonServiceTest {
    @ParameterizedTest
    @MethodSource("mealStatuses")
    void aggregatesMealStatus(boolean recorded, boolean flexible, List<String> statuses, String expected) {
        var groups = statuses.stream().map(status -> new GroupStatusDto(1L, "Grupo", BigDecimal.ONE,
            BigDecimal.ZERO, status)).toList();
        assertThat(ComparisonService.mealStatus(recorded, flexible, groups)).isEqualTo(expected);
    }

    static Stream<Arguments> mealStatuses() {
        return Stream.of(
            Arguments.of(false, false, List.of("SIN_ANOTAR"), "SIN_ANOTAR"),
            Arguments.of(true, false, List.of(), "REGISTRADA"),
            Arguments.of(true, false, List.of("EN_PLAN"), "EN_PLAN"),
            Arguments.of(true, false, List.of("CASI"), "CASI"),
            Arguments.of(true, false, List.of("SIN_ANOTAR"), "CASI"),
            Arguments.of(true, false, List.of("DE_MAS"), "DE_MAS"),
            Arguments.of(true, false, List.of("CASI", "DE_MAS"), "MIXED"),
            Arguments.of(true, false, List.of("SIN_ANOTAR", "DE_MAS"), "MIXED"),
            Arguments.of(true, false, List.of("PREGUNTAR"), "PREGUNTAR"),
            Arguments.of(true, false, List.of("CASI", "PREGUNTAR"), "CASI"),
            Arguments.of(true, true, List.of("CASI", "DE_MAS", "PREGUNTAR"), "FLEXIBLE"),
            Arguments.of(false, true, List.of(), "FLEXIBLE"));
    }
}
