package uy.miga.reglas;
import java.math.BigDecimal;
import java.util.Map;
import java.util.stream.Collectors;
public final class RuleText {
    private RuleText() {}
    private static String number(BigDecimal value) { return value.stripTrailingZeros().toPlainString().replace('.', ','); }
    public static String describe(FoodRuleDto r, Map<Long, String> groupNames) {
        String group = r.foodGroupId() == null ? "grupo" : groupNames.getOrDefault(r.foodGroupId(), "grupo");
        return switch (r.tipo()) {
            case "LIBRE" -> r.alimento() + ": libre";
            case "FLEXIBLE" -> r.alimento() + ": cuenta como comida flexible";
            case "NO_CUENTA" -> r.alimento() + ": no suma";
            case "COMPUESTO" -> "1 " + r.alimento() + " = " + r.componentes().stream()
                .map(c -> number(BigDecimal.valueOf(c.porciones())) + " " + (c.foodGroupId() == null ? (c.standardGroupKey() == null ? "grupo" : c.standardGroupKey()) : groupNames.getOrDefault(c.foodGroupId(), "grupo")))
                .collect(Collectors.joining(" + "));
            default -> r.cantidadPorPorcion() != null ? number(r.cantidadPorPorcion()) + " " + r.unidad() + " de " + r.alimento() + " = 1 porción de " + group
                : "1 " + r.alimento() + " = " + number(r.porcionPorDefecto()) + " " + group;
        };
    }
}
