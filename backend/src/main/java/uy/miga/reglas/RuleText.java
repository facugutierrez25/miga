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
        return switch (r.type()) {
            case "LIBRE" -> r.food() + ": libre";
            case "FLEXIBLE" -> r.food() + ": cuenta como comida flexible";
            case "NO_CUENTA" -> r.food() + ": no suma";
            case "COMPUESTO" -> "1 " + r.food() + compoundMeasure(r) + " = " + r.components().stream()
                .map(c -> componentText(c, groupNames))
                .collect(Collectors.joining(" + "));
            default -> r.amountPerPortion() != null
                ? number(r.amountPerPortion()) + " " + r.unit() + " de " + r.food() + " = 1 porción de " + group
                : "1 " + r.food() + " = " + number(r.defaultPortions()) + " " + portionUnit(r.defaultPortions())
                    + " de " + group;
        };
    }

    private static String compoundMeasure(FoodRuleDto r) {
        return r.amountPerPortion() != null ? " (" + number(r.amountPerPortion()) + " " + r.unit() + ")" : "";
    }

    private static String componentText(RuleComponent c, Map<Long, String> groupNames) {
        BigDecimal portions = BigDecimal.valueOf(c.portions());
        String group = c.foodGroupId() != null
            ? groupNames.getOrDefault(c.foodGroupId(), "grupo")
            : (c.standardGroupKey() == null ? "grupo" : c.standardGroupKey());
        return number(portions) + " " + portionUnit(portions) + " de " + group;
    }
}
