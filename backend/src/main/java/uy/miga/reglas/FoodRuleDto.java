package uy.miga.reglas;

import java.math.BigDecimal;
import java.util.List;

public record FoodRuleDto(
    Long id,
    String alcance,
    Long planId,
    Long userId,
    String alimento,
    List<String> sinonimos,
    String tipo,
    String standardGroupKey,
    Long foodGroupId,
    List<Componente> componentes,
    BigDecimal cantidadPorPorcion,
    String unidad,
    BigDecimal porcionPorDefecto,
    java.util.UUID uid,
    java.util.UUID overridesRuleUid
) {
    public FoodRuleDto {
        sinonimos = sinonimos == null ? List.of() : List.copyOf(sinonimos);
    }

    public FoodRuleDto(Long id, String alcance, Long planId, Long userId, String alimento, List<String> sinonimos,
        String tipo, String standardGroupKey, Long foodGroupId, List<Componente> componentes,
        BigDecimal cantidadPorPorcion, String unidad, BigDecimal porcionPorDefecto) {
        this(id, alcance, planId, userId, alimento, sinonimos, tipo, standardGroupKey, foodGroupId, componentes,
            cantidadPorPorcion, unidad, porcionPorDefecto, null, null);
    }
}
