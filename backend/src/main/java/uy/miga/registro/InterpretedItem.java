package uy.miga.registro;

import uy.miga.reglas.Componente;

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
    List<Componente> components,
    String tipo
) {
    static InterpretedItem unrecognized(String originalText) {
        return new InterpretedItem(originalText, originalText, BigDecimal.ONE, "u",
            null, null, null, null, false, null, null, null);
    }

    boolean recognized() { return portions != null; }
}
