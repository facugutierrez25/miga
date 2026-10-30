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
    BigDecimal porcionPorDefecto
) {}
