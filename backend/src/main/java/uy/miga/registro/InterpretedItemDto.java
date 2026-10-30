package uy.miga.registro;

import java.math.BigDecimal;

record InterpretedItemDto(
    String originalText,
    String foodName,
    BigDecimal quantity,
    String unit,
    Long foodGroupId,
    String standardGroupKey,
    BigDecimal portions,
    String appliedRule,
    boolean uncertain,
    boolean recognized,
    String tipo
) {}
