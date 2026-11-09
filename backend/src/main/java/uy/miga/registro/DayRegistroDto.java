package uy.miga.registro;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

record DayRegistroDto(
    LocalDate date,
    List<MealDayDto> meals,
    List<DailySummaryDto> summary
) {
    record MealDayDto(
        Long mealId,
        Long noteId,
        String noteText,
        Long noteVersion,
        List<EntryItemDto> items,
        List<GroupStatusDto> comparison
    ) {}

    record EntryItemDto(
        Long id,
        String food,
        Double quantity,
        String unit,
        Long foodGroupId,
        BigDecimal portions,
        String origin,
        Boolean uncertain,
        String originalText,
        String appliedRule,
        UUID occurrenceId,
        // NORMAL, COMPUESTO, LIBRE, FLEXIBLE, NO_CUENTA o PREGUNTAR
        String ruleType,
        // PLAN, CATALOGO o USUARIO
        String ruleSource
    ) {}

    record DailySummaryDto(
        Long foodGroupId,
        String name,
        String clave,
        BigDecimal totalRecorded
    ) {}
}
