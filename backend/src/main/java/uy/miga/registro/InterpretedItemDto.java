package uy.miga.registro;

import com.fasterxml.jackson.annotation.JsonProperty;

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
    @JsonProperty("tipo") String type
) {}
