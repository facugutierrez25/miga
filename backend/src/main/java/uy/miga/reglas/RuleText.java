package uy.miga.reglas;
import java.math.BigDecimal;
import java.util.Map;
import java.util.stream.Collectors;
public final class RuleText {
    private RuleText() {}
    private static String number(BigDecimal value) { return value.stripTrailingZeros().toPlainString().replace('.', ','); }
    public static String portionUnit(BigDecimal value) {
        return value != null && BigDecimal.ONE.compareTo(value) == 0 ? "porción" : "porciones";
    }
    public static String describe(FoodRuleDto r, Map<Long, String> groupNames) {
        String group = r.foodGroupId() == null ? "grupo" : groupNames.getOrDefault(r.foodGroupId(), "grupo");
        return switch (r.tipo()) {
            case "LIBRE" -> r.alimento() + ": libre";
            case "FLEXIBLE" -> r.alimento() + ": cuenta como comida flexible";
            case "NO_CUENTA" -> r.alimento() + ": no suma";
            case "COMPUESTO" -> "1 " + r.alimento() + compoundMeasure(r) + " = " + r.componentes().stream()
                .map(c -> componentText(c, groupNames))
                .collect(Collectors.joining(" + "));
            default -> r.cantidadPorPorcion() != null
                ? number(r.cantidadPorPorcion()) + " " + r.unidad() + " de " + r.alimento() + " = 1 porción de " + group
                : "1 " + r.alimento() + " = " + number(r.porcionPorDefecto()) + " " + portionUnit(r.porcionPorDefecto())
                    + " de " + group;
        };
    }

    private static String compoundMeasure(FoodRuleDto r) {
        return r.cantidadPorPorcion() != null ? " (" + number(r.cantidadPorPorcion()) + " " + r.unidad() + ")" : "";
    }

    private static String componentText(Componente c, Map<Long, String> groupNames) {
        BigDecimal portions = BigDecimal.valueOf(c.porciones());
        String group = c.foodGroupId() != null
            ? groupNames.getOrDefault(c.foodGroupId(), "grupo")
            : (c.standardGroupKey() == null ? "grupo" : c.standardGroupKey());
        return number(portions) + " " + portionUnit(portions) + " de " + group;
    }
}
