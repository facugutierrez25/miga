package uy.miga.registro;

import org.springframework.stereotype.Service;
import uy.miga.reglas.FoodRuleDto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
class InterpreterService {

    private static final Pattern HARD_SEP = Pattern.compile(",|;|\\+|(?<=\\S)\\.(?=\\s|$)");

    private static final Pattern QUANTITY_PREFIX = Pattern.compile(
        "^(\\d+(?:[.,]\\d+)?|medios?|un[ao]?)\\s+",
        Pattern.CASE_INSENSITIVE
    );

    private static final Map<String, String> UNIT_DIMENSION = new LinkedHashMap<>();
    private static final Map<String, String> UNIT_CANONICAL = new LinkedHashMap<>();

    static {
        for (String u : List.of("ml", "cc", "mililitro", "mililitros"))
            { UNIT_DIMENSION.put(u, "VOL"); UNIT_CANONICAL.put(u, "ml"); }
        for (String u : List.of("l", "litro", "litros"))
            { UNIT_DIMENSION.put(u, "VOL"); UNIT_CANONICAL.put(u, "l"); }
        for (String u : List.of("taza", "tazas"))
            { UNIT_DIMENSION.put(u, "VOL"); UNIT_CANONICAL.put(u, "taza"); }
        for (String u : List.of("vaso", "vasos"))
            { UNIT_DIMENSION.put(u, "VOL"); UNIT_CANONICAL.put(u, "vaso"); }
        for (String u : List.of("cucharada", "cucharadas", "cda"))
            { UNIT_DIMENSION.put(u, "VOL"); UNIT_CANONICAL.put(u, "cucharada"); }
        for (String u : List.of("cucharadita", "cucharaditas", "cdita"))
            { UNIT_DIMENSION.put(u, "VOL"); UNIT_CANONICAL.put(u, "cucharadita"); }
        for (String u : List.of("g", "gr", "gramo", "gramos"))
            { UNIT_DIMENSION.put(u, "MASS"); UNIT_CANONICAL.put(u, "g"); }
        for (String u : List.of("kg", "kilo", "kilos", "kilogramo", "kilogramos"))
            { UNIT_DIMENSION.put(u, "MASS"); UNIT_CANONICAL.put(u, "kg"); }
        for (String u : List.of("unidad", "unidades", "u", "porcion", "porciones", "porcion"))
            { UNIT_DIMENSION.put(u, "COUNT"); UNIT_CANONICAL.put(u, "u"); }
        for (String u : List.of("rebanada", "rebanadas", "tajada", "tajadas",
                                 "rodaja", "rodajas", "feta", "fetas"))
            { UNIT_DIMENSION.put(u, "COUNT"); UNIT_CANONICAL.put(u, "rebanada"); }
    }

    private static final Map<String, Double> TO_BASE = Map.of(
        "ml", 1.0, "l", 1000.0, "taza", 240.0, "vaso", 200.0,
        "cucharada", 15.0, "cucharadita", 5.0,
        "g", 1.0, "kg", 1000.0,
        "u", 1.0, "rebanada", 1.0
    );

    List<InterpretedItem> interpret(String text, List<FoodRuleDto> rules) {
        if (text == null || text.isBlank()) return List.of();

        String normalized = normalize(text);
        String[] segments = HARD_SEP.split(normalized);

        List<InterpretedItem> result = new ArrayList<>();
        for (String seg : segments) {
            String s = seg.strip();
            if (!s.isBlank()) result.add(interpretSegment(s, rules));
        }
        return result;
    }

    private InterpretedItem interpretSegment(String segment, List<FoodRuleDto> rules) {
        double rawQty = 1.0;
        String remaining = segment;

        Matcher m = QUANTITY_PREFIX.matcher(segment);
        if (m.find()) {
            rawQty = parseQuantity(m.group(1));
            remaining = segment.substring(m.end()).strip();
        }

        String detectedUnit = null;
        String foodName = remaining;

        for (Map.Entry<String, String> entry : UNIT_CANONICAL.entrySet()) {
            String key = entry.getKey();
            if (remaining.startsWith(key + " ")) {
                detectedUnit = entry.getValue();
                foodName = remaining.substring(key.length()).strip();
                break;
            }
            if (remaining.equals(key)) {
                detectedUnit = entry.getValue();
                foodName = "";
                break;
            }
        }

        if (foodName.isBlank()) return InterpretedItem.unrecognized(segment);

        FoodRuleDto rule = findRule(foodName, rules);
        if (rule == null) return InterpretedItem.unrecognized(segment);

        return computePortions(segment, rawQty, detectedUnit, rule);
    }

    FoodRuleDto findRule(String name, List<FoodRuleDto> rules) {
        for (FoodRuleDto r : rules) {
            if (normalize(r.alimento()).equals(name)) return r;
        }
        for (FoodRuleDto r : rules) {
            if (r.sinonimos() != null)
                for (String s : r.sinonimos())
                    if (normalize(s).equals(name)) return r;
        }
        List<FoodRuleDto> candidates = new ArrayList<>();
        int bestDist = 3;
        for (FoodRuleDto r : rules) {
            int d = levenshtein(name, normalize(r.alimento()));
            if (d < bestDist) { bestDist = d; candidates.clear(); candidates.add(r); }
            else if (d == bestDist) candidates.add(r);
            if (r.sinonimos() != null) {
                for (String s : r.sinonimos()) {
                    d = levenshtein(name, normalize(s));
                    if (d < bestDist) { bestDist = d; candidates.clear(); candidates.add(r); }
                    else if (d == bestDist && !candidates.contains(r)) candidates.add(r);
                }
            }
        }
        return (candidates.size() == 1 && bestDist <= 2) ? candidates.get(0) : null;
    }

    private InterpretedItem computePortions(String originalText, double qty,
                                            String unit, FoodRuleDto rule) {
        boolean uncertain = false;
        BigDecimal portions;
        String appliedRule;

        switch (rule.tipo()) {
            case "NO_CUENTA" -> {
                portions = BigDecimal.ZERO;
                appliedRule = rule.alimento() + " = no cuenta";
            }
            case "LIBRE" -> {
                portions = BigDecimal.ONE;
                appliedRule = rule.alimento() + " = libre";
            }
            case "COMPUESTO" -> {
                portions = rule.porcionPorDefecto().multiply(BigDecimal.valueOf(qty))
                    .setScale(3, RoundingMode.HALF_UP);
                appliedRule = rule.alimento() + " (compuesto)";
            }
            default -> {
                if (rule.cantidadPorPorcion() != null && rule.unidad() != null && unit != null) {
                    BigDecimal converted = convert(BigDecimal.valueOf(qty), unit, rule.unidad());
                    if (converted != null) {
                        portions = converted.divide(rule.cantidadPorPorcion(), 3, RoundingMode.HALF_UP);
                        appliedRule = rule.cantidadPorPorcion() + " " + rule.unidad()
                            + " " + rule.alimento() + " = 1 porcion";
                    } else {
                        portions = rule.porcionPorDefecto().multiply(BigDecimal.valueOf(qty))
                            .setScale(3, RoundingMode.HALF_UP);
                        uncertain = true;
                        appliedRule = rule.alimento() + " = " + rule.porcionPorDefecto() + " porcion (supuesto)";
                    }
                } else {
                    portions = rule.porcionPorDefecto().multiply(BigDecimal.valueOf(qty))
                        .setScale(3, RoundingMode.HALF_UP);
                    appliedRule = rule.alimento() + " = " + rule.porcionPorDefecto() + " porcion";
                }
            }
        }

        return new InterpretedItem(
            originalText, rule.alimento(),
            BigDecimal.valueOf(qty),
            unit != null ? unit : (rule.unidad() != null ? rule.unidad() : "u"),
            rule.foodGroupId(), rule.standardGroupKey(),
            portions, appliedRule, uncertain, rule.id(),
            "COMPUESTO".equals(rule.tipo()) ? rule.componentes() : null
        );
    }

    BigDecimal convert(BigDecimal qty, String from, String to) {
        String dimFrom = UNIT_DIMENSION.get(canonical(from));
        String dimTo   = UNIT_DIMENSION.get(canonical(to));
        if (dimFrom == null || dimTo == null || !dimFrom.equals(dimTo)) return null;
        Double factorFrom = TO_BASE.get(canonical(from));
        Double factorTo   = TO_BASE.get(canonical(to));
        if (factorFrom == null || factorTo == null) return null;
        return BigDecimal.valueOf(qty.doubleValue() * factorFrom / factorTo)
            .setScale(3, RoundingMode.HALF_UP);
    }

    private String canonical(String unit) {
        if (unit == null) return null;
        return UNIT_CANONICAL.getOrDefault(unit.toLowerCase(), unit.toLowerCase());
    }

    static String normalize(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s.toLowerCase().strip(), Normalizer.Form.NFD)
            .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
            .replaceAll("\\s+", " ");
    }

    private double parseQuantity(String s) {
        return switch (s.toLowerCase()) {
            case "medio", "media", "medios", "medias" -> 0.5;
            case "un", "una", "uno" -> 1.0;
            default -> Double.parseDouble(s.replace(",", "."));
        };
    }

    int levenshtein(String a, String b) {
        int la = a.length(), lb = b.length();
        if (Math.abs(la - lb) > 3) return 99;
        int[] prev = new int[lb + 1];
        for (int j = 0; j <= lb; j++) prev[j] = j;
        for (int i = 1; i <= la; i++) {
            int[] curr = new int[lb + 1];
            curr[0] = i;
            for (int j = 1; j <= lb; j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                curr[j] = Math.min(curr[j - 1] + 1, Math.min(prev[j] + 1, prev[j - 1] + cost));
            }
            prev = curr;
        }
        return prev[lb];
    }
}
