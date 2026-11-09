package uy.miga.registro;

import com.fasterxml.jackson.annotation.JsonProperty;

import uy.miga.reglas.RuleComponent;

import java.math.BigDecimal;
import java.util.List;

record InterpretedItem(
    String originalText,
    String foodName,
    BigDecimal quantity,
    String unit,
    Long foodGroupId,
    String standardGroupKey,
    BigDecimal portions,
    String appliedRule,
    boolean uncertain,
    Long ruleId,
    List<RuleComponent> components,
    @JsonProperty("tipo") String type
) {
    static InterpretedItem unrecognized(String originalText) {
        return new InterpretedItem(originalText, originalText, BigDecimal.ONE, "u",
            null, null, null, null, false, null, null, null);
    }

    boolean recognized() { return portions != null; }
}
