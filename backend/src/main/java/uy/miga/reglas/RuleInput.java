package uy.miga.reglas;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
public record RuleInput(String alimento, List<String> sinonimos, String tipo, Long foodGroupId,
    BigDecimal cantidadPorPorcion, String unidad, BigDecimal porcionPorDefecto,
    List<Componente> componentes, UUID overridesRuleUid) {}
